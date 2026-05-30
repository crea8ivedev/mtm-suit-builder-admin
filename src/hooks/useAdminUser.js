export function useAdminUser() {
  const name = localStorage.getItem("suit_admin_name") || "";
  const email = localStorage.getItem("suit_admin_email") || "";
  const initial = (name || email || "A").charAt(0).toUpperCase();
  return { name, email, initial };
}
