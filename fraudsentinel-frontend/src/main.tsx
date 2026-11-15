import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./styles.css";
import Landing from "./Landing";
import Customer from "./Customer";
import { Analytics, Cards, Detail, Live, Login, Overview, Queue, Relationships, Shell } from "./Analyst";

createRoot(document.getElementById("root")!).render(<React.StrictMode><BrowserRouter><Routes>
  <Route path="/" element={<Landing />} /><Route path="/customer" element={<Customer />} /><Route path="/analyst/login" element={<Login />} />
  <Route path="/analyst" element={<Shell />}><Route index element={<Overview />} /><Route path="live" element={<Live />} /><Route path="queue" element={<Queue />} />
    <Route path="investigations/:id" element={<Detail />} /><Route path="cards" element={<Cards />} /><Route path="relationships" element={<Relationships />} /><Route path="analytics" element={<Analytics />} /></Route>
</Routes></BrowserRouter></React.StrictMode>);
