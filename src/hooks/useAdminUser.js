import { useState, useEffect } from "react";

export function useAdminUser() {
  const storedEmail = localStorage.getItem("suit_admin_email") || "";
  const [name, setName] = useState(
    localStorage.getItem("suit_admin_name") || "",
  );
  const [email, setEmail] = useState(storedEmail);

  useEffect(() => {
    if (!storedEmail) return;
    fetch(`/api/auth/me?email=${encodeURIComponent(storedEmail)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.name) {
          setName(data.name);
          localStorage.setItem("suit_admin_name", data.name);
        }
        if (data.email) {
          setEmail(data.email);
          localStorage.setItem("suit_admin_email", data.email);
        }
      })
      .catch(() => {});
  }, [storedEmail]);

  const initial = (name || email || "A").charAt(0).toUpperCase();
  return { name, email, initial };
}
