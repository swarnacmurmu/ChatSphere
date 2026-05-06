import { useEffect, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";

function Home() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [typingUser, setTypingUser] = useState("");

  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const getChatId = (uid1, uid2) => {
    return uid1 > uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
  };

  const handleLogout = async () => {
    if (currentUser) {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        online: false,
        lastSeen: serverTimestamp(),
      });
    }

    await signOut(auth);
    navigate("/");
  };

  useEffect(() => {
    if (!currentUser) {
      navigate("/");
      return;
    }

    const usersRef = collection(db, "users");

    const unsubscribe = onSnapshot(usersRef, async (snapshot) => {
      const userList = await Promise.all(
        snapshot.docs
          .map((docItem) => docItem.data())
          .filter((user) => user.uid !== currentUser.uid)
          .map(async (user) => {
            const chatId = getChatId(currentUser.uid, user.uid);
            const chatRef = doc(db, "chats", chatId);
            const chatSnap = await getDoc(chatRef);

            return {
              ...user,
              lastMessage: chatSnap.exists()
                ? chatSnap.data().lastMessage
                : "",
            };
          })
      );

      setUsers(userList);
    });

    return () => unsubscribe();
  }, [currentUser, navigate]);

  useEffect(() => {
    if (!currentUser) return;

    const userRef = doc(db, "users", currentUser.uid);

    updateDoc(userRef, {
      online: true,
      lastSeen: serverTimestamp(),
    });

    const handleBeforeUnload = () => {
      updateDoc(userRef, {
        online: false,
        lastSeen: serverTimestamp(),
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      handleBeforeUnload();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!selectedUser || !currentUser) return;

    const chatId = getChatId(currentUser.uid, selectedUser.uid);

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt")
    );

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const allMessages = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }));

      setMessages(allMessages);
    });

    const chatRef = doc(db, "chats", chatId);

    const unsubscribeTyping = onSnapshot(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        setTypingUser(snapshot.data().typing || "");
      }
    });

    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
    };
  }, [selectedUser, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleTyping = async (value) => {
    setText(value);

    if (!selectedUser || !currentUser) return;

    const chatId = getChatId(currentUser.uid, selectedUser.uid);
    const chatRef = doc(db, "chats", chatId);

    await setDoc(
      chatRef,
      {
        users: [currentUser.uid, selectedUser.uid],
        typing: currentUser.uid,
      },
      { merge: true }
    );

    clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(async () => {
      await updateDoc(chatRef, {
        typing: "",
      });
    }, 1200);
  };

  const sendMessage = async () => {
    if (text.trim() === "" || !selectedUser || !currentUser) return;

    const chatId = getChatId(currentUser.uid, selectedUser.uid);
    const chatRef = doc(db, "chats", chatId);

    await setDoc(
      chatRef,
      {
        users: [currentUser.uid, selectedUser.uid],
        lastMessage: text,
        typing: "",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await addDoc(collection(db, "chats", chatId, "messages"), {
      text,
      senderId: currentUser.uid,
      receiverId: selectedUser.uid,
      createdAt: serverTimestamp(),
    });

    setText("");
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";

    const date = timestamp.toDate();

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="chat-page">
      <aside className="sidebar">
        <div className="profile-box">
          <div className="avatar">
            {currentUser?.email?.charAt(0).toUpperCase()}
          </div>

          <div>
            <h3>ChatSphere</h3>
            <p>{currentUser?.email}</p>
          </div>
        </div>

        <div className="search-box">
          <input placeholder="Search users..." />
        </div>

        <div className="chat-list">
          {users.length === 0 && (
            <p style={{ color: "#94a3b8", textAlign: "center" }}>
              No users found
            </p>
          )}

          {users.map((user) => (
            <div
              key={user.uid}
              className={`chat-user ${
                selectedUser?.uid === user.uid ? "active" : ""
              }`}
              onClick={() => setSelectedUser(user)}
            >
              <div className="avatar small">
                {user.name?.charAt(0).toUpperCase()}
              </div>

              <div>
                <h4>{user.name}</h4>
                <p>{user.online ? "Online" : user.lastMessage || user.email}</p>
              </div>
            </div>
          ))}
        </div>

        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </aside>

      <main className="chat-window">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <h2>{selectedUser.name}</h2>
              <p>
                {typingUser === selectedUser.uid
                  ? `${selectedUser.name} is typing...`
                  : selectedUser.online
                  ? "Online"
                  : "Offline"}
              </p>
            </div>

            <div className="messages-area">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`message ${
                    msg.senderId === currentUser.uid ? "sent" : "received"
                  }`}
                >
                  <span>{msg.text}</span>
                  <small>{formatTime(msg.createdAt)}</small>
                </div>
              ))}

              <div ref={messagesEndRef}></div>
            </div>

            <div className="message-input">
              <input
                value={text}
                placeholder="Type your message..."
                onChange={(e) => handleTyping(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
              />

              <button onClick={sendMessage}>Send</button>
            </div>
          </>
        ) : (
          <div className="empty-chat">
            <h2>Select a user to start chatting</h2>
          </div>
        )}
      </main>
    </div>
  );
}

export default Home;
