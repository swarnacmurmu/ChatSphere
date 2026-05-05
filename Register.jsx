import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name,
        email,
        createdAt: new Date(),
      });

      navigate("/home");
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Create account</h2>
        <p className="subtitle">Join ChatSphere and start chatting.</p>

        <form onSubmit={handleRegister}>
          <input
            type="text"
            placeholder="Enter your name"
            onChange={(e) => setName(e.target.value)}
            required
          />

          <input
            type="email"
            placeholder="Enter email"
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Minimum 6 characters"
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit">Create account</button>
        </form>

        <p className="switch">
          Already registered? <Link to="/">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;