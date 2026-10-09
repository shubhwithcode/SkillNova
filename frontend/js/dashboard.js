const studentName = sessionStorage.getItem("skillnovaUserName");

if (!studentName) {
	window.location.replace("index.html");
} else {
	document.querySelectorAll("[data-user-name]").forEach((element) => {
		element.textContent = studentName;
	});
}

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
	logoutButton.addEventListener("click", () => {
		sessionStorage.removeItem("skillnovaUserName");
		sessionStorage.removeItem("skillnovaUserEmail");
		window.location.href = "index.html";
	});
}
