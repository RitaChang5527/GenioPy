import { Link } from "react-router-dom";
import { useContext, useEffect } from "react";
import { UserContext } from "./UserContext";

export default function Header() {
  const { setUserInfo, userInfo } = useContext(UserContext);
  useEffect(() => {
    fetch("http://localhost:4000/profile", {
      credentials: "include",
    }).then(response => {
      response.json().then(userInfo => {
        setUserInfo(userInfo);
      });
    });
  }, []);

  function logout() {
    fetch("http://localhost:4000/logout", {
      credentials: "include",
      method: "POST",
    });
    setUserInfo(null);
  }

  const email = userInfo?.email;

  return (
    <header>
      <Link to="/" className="logo">
        GenioPy.
      </Link>
      <nav>
        {email && (
          <>
            <Link to="/draw">Draw</Link>
            <Link to="/create">Create new post</Link>
            <a onClick={logout}>Logout ({email})</a>
          </>
        )}
        {!email && (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </nav>
    </header>
  );
}
