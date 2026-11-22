import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles.css";
import Landing from "./Landing";
import BankEventSimulator from "./BankEventSimulator";
import { Analytics, Cards, Detail, Live, Login, Overview, Queue, Relationships, Shell } from "./Analyst";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/simulator" element={<BankEventSimulator />} />
        {/* Redirect legacy /customer route to bank switch simulator */}
        <Route path="/customer" element={<Navigate to="/simulator" replace />} />
        <Route path="/analyst/login" element={<Login />} />
        <Route path="/analyst" element={<Shell />}>
          <Route index element={<Overview />} />
          <Route path="live" element={<Live />} />
          <Route path="queue" element={<Queue />} />
          <Route path="investigations/:id" element={<Detail />} />
          <Route path="cards" element={<Cards />} />
          <Route path="relationships" element={<Relationships />} />
          <Route path="analytics" element={<Analytics />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
