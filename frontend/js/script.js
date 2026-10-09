// ============================
// LOGIN / REGISTER SECTION
// ============================

const loginSection = document.getElementById("loginSection");
const registerSection = document.getElementById("registerSection");

const createAccountBtn = document.getElementById("createAccountBtn");
const loginBtn = document.getElementById("loginBtn");


// ============================
// OPEN REGISTER
// ============================

if (createAccountBtn) {

    createAccountBtn.addEventListener("click", function () {

        loginSection.style.display = "none";

        registerSection.style.display = "block";

    });

}


// ============================
// OPEN LOGIN
// ============================

if (loginBtn) {

    loginBtn.addEventListener("click", function () {

        registerSection.style.display = "none";

        loginSection.style.display = "block";

    });

}


// ============================
// LOGIN FORM
// ============================

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", function (event) {

        event.preventDefault();


        const email =
            document.getElementById("email").value.trim();

        const password =
            document.getElementById("password").value.trim();


        // Basic validation

        if (email === "" || password === "") {

            showToast("Please fill all fields.");

            return;

        }


        const savedName = localStorage.getItem(
            `skillnova:name:${email.toLowerCase()}`
        );

        openStudentDashboard(savedName || nameFromEmail(email), email);

    });

}


// ============================
// REGISTER FORM
// ============================

const registerForm =
    document.getElementById("registerForm");

if (registerForm) {

    registerForm.addEventListener("submit", function (event) {

        event.preventDefault();


        const name =
            document.getElementById("registerName").value.trim();

        const email =
            document.getElementById("registerEmail").value.trim();

        const password =
            document.getElementById("registerPassword").value.trim();

        const confirmPassword =
            document.getElementById("confirmPassword").value.trim();


        // Basic validation

        if (
            name === "" ||
            email === "" ||
            password === "" ||
            confirmPassword === ""
        ) {

            showToast("Please fill all fields.");

            return;

        }

        if (password !== confirmPassword) {
            showToast("Passwords do not match.");
            return;
        }

        localStorage.setItem(`skillnova:name:${email.toLowerCase()}`, name);
        openStudentDashboard(name, email);

    });

}


// ============================
// LOGIN PASSWORD SHOW / HIDE
// ============================

const showPassword =
    document.getElementById("showPassword");

const password =
    document.getElementById("password");


if (showPassword && password) {

    showPassword.addEventListener("click", function () {

        if (password.type === "password") {

            password.type = "text";

            showPassword.textContent = "Hide";

        } else {

            password.type = "password";

            showPassword.textContent = "Show";

        }

    });

}


// ============================
// REGISTER PASSWORD SHOW / HIDE
// ============================

const showRegisterPassword =
    document.getElementById("showRegisterPassword");

const registerPassword =
    document.getElementById("registerPassword");


if (showRegisterPassword && registerPassword) {

    showRegisterPassword.addEventListener("click", function () {

        if (registerPassword.type === "password") {

            registerPassword.type = "text";

            showRegisterPassword.textContent = "Hide";

        } else {

            registerPassword.type = "password";

            showRegisterPassword.textContent = "Show";

        }

    });

}


// ============================
// GOOGLE LOGIN
// ============================

const googleLogin =
    document.getElementById("googleLogin");


if (googleLogin) {

    googleLogin.addEventListener("click", function () {

        showToast("Google login will be connected later.");

    });

}


// ============================
// TOAST MESSAGE
// ============================

function showToast(message) {

    const toast =
        document.getElementById("toast");


    if (!toast) {
        return;
    }


    toast.textContent = message;

    toast.classList.add("show");


    setTimeout(function () {

        toast.classList.remove("show");

    }, 2500);

}

function nameFromEmail(email) {
    const localPart = email.split("@")[0].replace(/[._-]+/g, " ").trim();

    if (!localPart) {
        return "Student";
    }

    return localPart
        .split(/\s+/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
}

function openStudentDashboard(name, email) {
    sessionStorage.setItem("skillnovaUserName", name);
    sessionStorage.setItem("skillnovaUserEmail", email);
    window.location.href = "dashboard.html";
}