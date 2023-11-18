
import AceEditor from "react-ace";
import "react-quill/dist/quill.snow.css";
import { Navigate } from "react-router-dom";
import { useState } from "react";
import Editor from "../Editor";

import "ace-builds/src-noconflict/mode-python";
import "ace-builds/src-noconflict/theme-monokai";

export default function CreatePost() {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState("");
  const [redirect, setRedirect] = useState(false);
  async function createNewPost(ev) {
    const data = new FormData();
    data.set("title", title);
    data.set("summary", summary);
    data.set("content", content);
    data.set("file", files[0]);
    ev.preventDefault();
    const response = await fetch("http://localhost:4000/post", {
      method: "POST",
      body: data,
      credentials: "include",
    });
    if (response.ok) {
      setRedirect(true);
    }
  }
  if (redirect) {
    return <Navigate to={"/"} />;
  }
  return (
    <form onSubmit={createNewPost}>
      <input
        type="title"
        placeholder={"Title"}
        value={title}
        onChange={(ev) => setTitle(ev.target.value)}
      />
      <input
        type="summary"
        placeholder={"Summary"}
        value={summary}
        onChange={(ev) => setSummary(ev.target.value)}
      />
      <input type="file" onChange={(ev) => setFiles(ev.target.files)} />
      <Editor value={content} onChange={setContent} />
      <button style={{ marginTop: "5px" }}>Create post</button>
    </form>
  );
}

// import React from "react";
// import dynamic from "next/dynamic";
// import "@uiw/react-textarea-code-editor/dist.css";

// const CodeEditor = dynamic(
//   () => import("@uiw/react-textarea-code-editor").then((mod) => mod.default),
//   { ssr: false }
// );

// function HomePage() {
//   const [code, setCode] = React.useState(
//     `function add(a, b) {\n  return a + b;\n}`
//   );
//   return (
//     <div>
//       <CodeEditor
//         value={code}
//         language="js"
//         placeholder="Please enter JS code."
//         onChange={(evn) => setCode(evn.target.value)}
//         padding={15}
//         style={{
//           fontSize: 12,
//           backgroundColor: "#f5f5f5",
//           fontFamily:
//             "ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace",
//         }}
//       />
//     </div>
//   );
// }

// export default HomePage;
