// ====================================================================
// SkillNova - profile.js
// Profile page: load + edit personal details, target role and the
// technical skill list (0-100 sliders). Saves through /api/profile.
// ====================================================================

const pf = {
    status: document.getElementById("profileStatus"),
    error: document.getElementById("profileError"),
    saved: document.getElementById("profileSaved"),
    view: document.getElementById("profileView"),
    form: document.getElementById("profileForm"),
    name: document.getElementById("pfName"),
    email: document.getElementById("pfEmail"),
    college: document.getElementById("pfCollege"),
    degree: document.getElementById("pfDegree"),
    year: document.getElementById("pfYear"),
    role: document.getElementById("pfRole"),
    soft: document.getElementById("pfSoft"),
    certs: document.getElementById("pfCerts"),
    saveProfile: document.getElementById("saveProfileButton"),
    skillRows: document.getElementById("skillRows"),
    addSelect: document.getElementById("addSkillSelect"),
    addButton: document.getElementById("addSkillButton"),
    saveSkills: document.getElementById("saveSkillsButton"),
};

let allSkills = [];           // [{id, name, category}]
let mySkills = new Map();     // skillId -> proficiency

function showMessage(element, message) {
    element.textContent = message;
    element.hidden = false;
    setTimeout(() => { element.hidden = true; }, 4000);
}

// ---- Skill rows ----
function renderSkillRows() {
    pf.skillRows.innerHTML = "";
    if (mySkills.size === 0) {
        const p = document.createElement("p");
        p.className = "empty-state";
        p.textContent = "No skills added yet. Pick one below and click + Add.";
        pf.skillRows.append(p);
    }

    mySkills.forEach((proficiency, skillId) => {
        const skill = allSkills.find((s) => s.id === skillId);
        if (!skill) return;

        const row = document.createElement("div");
        row.className = "skill-edit-row";

        const label = document.createElement("span");
        label.style.fontSize = "12px";
        label.textContent = skill.name;

        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = "100";
        slider.step = "5";
        slider.value = proficiency;
        slider.setAttribute("aria-label", skill.name + " proficiency");

        const output = document.createElement("output");
        output.textContent = proficiency + "%";
        slider.addEventListener("input", () => {
            mySkills.set(skillId, Number(slider.value));
            output.textContent = slider.value + "%";
        });

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "remove-skill";
        remove.title = "Remove " + skill.name;
        remove.textContent = "✕";
        remove.addEventListener("click", () => {
            mySkills.delete(skillId);
            renderSkillRows();
            refreshAddOptions();
        });

        const sliderWrap = document.createElement("span");
        sliderWrap.style.display = "flex";
        sliderWrap.style.gap = "8px";
        sliderWrap.style.alignItems = "center";
        sliderWrap.append(slider, output);

        row.append(label, sliderWrap, remove);
        pf.skillRows.append(row);
    });
}

function refreshAddOptions() {
    pf.addSelect.innerHTML = "";
    const remaining = allSkills.filter((s) => !mySkills.has(s.id));
    if (remaining.length === 0) {
        pf.addSelect.innerHTML = "<option value=''>All skills added</option>";
        return;
    }
    pf.addSelect.innerHTML = "<option value=''>— Pick a skill to add —</option>";
    remaining.forEach((skill) => {
        const option = document.createElement("option");
        option.value = skill.id;
        option.textContent = `${skill.name} (${skill.category || "General"})`;
        pf.addSelect.append(option);
    });
}

pf.addButton.addEventListener("click", () => {
    const skillId = Number(pf.addSelect.value);
    if (!skillId) return;
    mySkills.set(skillId, 50); // sensible default
    renderSkillRows();
    refreshAddOptions();
});

// ---- Load everything ----
async function loadProfile() {
    pf.status.hidden = false;
    pf.view.hidden = true;
    try {
        const [options, me] = await Promise.all([
            window.snApi.get("/api/profile/options"),
            window.snApi.get("/api/profile"),
        ]);

        allSkills = options.skills || [];

        // Job role dropdown
        pf.role.innerHTML = '<option value="">— Not selected —</option>';
        options.jobRoles.forEach((role) => {
            const option = document.createElement("option");
            option.value = role.id;
            option.textContent = role.name;
            pf.role.append(option);
        });

        // Fill the form
        const profile = me.profile;
        pf.name.value = profile.full_name || "";
        pf.email.value = profile.email || "";
        pf.college.value = profile.college || "";
        pf.degree.value = profile.degree || "";
        pf.year.value = profile.graduation_year || "";
        pf.role.value = profile.target_role_id || "";
        pf.soft.value = profile.soft_skills || "";
        pf.certs.value = profile.certifications || "";

        // Skills
        mySkills = new Map(me.skills.map((s) => [s.id, s.proficiency]));
        renderSkillRows();
        refreshAddOptions();

        pf.view.hidden = false;
    } catch (error) {
        showMessage(pf.error, error.message);
    } finally {
        pf.status.hidden = true;
    }
}

// ---- Save profile details ----
pf.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fullName = pf.name.value.trim();
    if (fullName.length < 2) {
        showMessage(pf.error, "Please enter your full name.");
        return;
    }
    pf.saveProfile.disabled = true;
    try {
        await window.snApi.send("/api/profile", "PUT", {
            fullName,
            college: pf.college.value.trim(),
            degree: pf.degree.value.trim(),
            graduationYear: pf.year.value ? Number(pf.year.value) : null,
            targetRoleId: pf.role.value ? Number(pf.role.value) : null,
            softSkills: pf.soft.value.trim(),
            certifications: pf.certs.value.trim(),
        });
        // Keep the dashboard greeting in sync.
        sessionStorage.setItem("skillnovaUserName", fullName);
        showMessage(pf.saved, "✓ Profile saved successfully.");
    } catch (error) {
        showMessage(pf.error, error.message);
    } finally {
        pf.saveProfile.disabled = false;
    }
});

// ---- Save skills ----
pf.saveSkills.addEventListener("click", async () => {
    pf.saveSkills.disabled = true;
    try {
        const skills = [...mySkills.entries()].map(([skillId, proficiency]) => ({
            skillId,
            proficiency,
        }));
        await window.snApi.send("/api/profile/skills", "PUT", { skills });
        showMessage(pf.saved, "✓ Skills saved successfully.");
    } catch (error) {
        showMessage(pf.error, error.message);
    } finally {
        pf.saveSkills.disabled = false;
    }
});

loadProfile();
