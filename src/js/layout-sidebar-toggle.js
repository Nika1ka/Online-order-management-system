document.addEventListener("DOMContentLoaded", () => {
  const appShell = document.querySelector(".app-shell");
  const sidebar = document.querySelector(".sidebar");
  const breadcrumb = document.querySelector(".breadcrumb");

  if (!appShell || !sidebar || !breadcrumb) {
    console.warn("[layout-sidebar-toggle] Required layout elements were not found");
    return;
  }

  let menuToggle = breadcrumb.querySelector(".breadcrumb__menu");

  if (!menuToggle) {
    menuToggle = document.createElement("div");
    menuToggle.className = "breadcrumb__menu";
    menuToggle.setAttribute("role", "button");
    menuToggle.setAttribute("tabindex", "0");
    menuToggle.setAttribute("aria-label", "Згорнути або розгорнути бічну панель");
    menuToggle.innerHTML = '<img src="assets/icons/menu.png" alt="" class="icon icon--menu">';
    breadcrumb.prepend(menuToggle);
  }

  const toggleSidebar = () => {
    appShell.classList.toggle("app-shell--sidebar-collapsed");
  };

  menuToggle.addEventListener("click", toggleSidebar);
  menuToggle.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleSidebar();
    }
  });
});
