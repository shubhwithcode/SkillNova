// ====================================================================
// SkillNova - main.js
// Shared behavior for the public pages (Home, About, Features):
// the mobile hamburger menu.
// ====================================================================

const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
        const isOpen = navLinks.classList.toggle("open");

        navToggle.setAttribute("aria-expanded", String(isOpen));
        navToggle.setAttribute(
            "aria-label",
            isOpen ? "Close menu" : "Open menu"
        );
    });

    // Close the menu after choosing a link (mobile usability).
    navLinks.addEventListener("click", function (event) {
        if (event.target.tagName === "A") {
            navLinks.classList.remove("open");
            navToggle.setAttribute("aria-expanded", "false");
        }
    });
}
