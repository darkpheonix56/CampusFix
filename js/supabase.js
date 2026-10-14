
const SUPABASE_URL = "https://ggvyervazmhhdeafjhrc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_jTU-xRgmIOPU3jLYF9QRvw_LeO0PocF";

const campusSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

window.campusSupabase = campusSupabase;

const currentPage =
    window.location.pathname.split("/").pop() || "index.html";

// Check whether a user is logged in.
async function requireLogin() {
    const { data, error } = await campusSupabase.auth.getSession();

    if (error) {
        console.error("Session error:", error.message);
        return null;
    }

    if (!data.session) {
        window.location.href = "login.html";
        return null;
    }

    return data.session;
}

// Get the user's role from the profiles table.
async function getUserRole(userId) {
    const { data, error } = await campusSupabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        console.error("Could not fetch user role:", error.message);
        return null;
    }

    return data?.role || null;
}

// Redirect according to the user's role.
async function redirectByRole(userId) {
    const role = await getUserRole(userId);

    if (role === "admin") {
        window.location.href = "admin.html";
    } else if (role === "student") {
        window.location.href = "index.html";
    } else {
        alert(
            "Could not verify your account role. " +
            "Please check your profile in Supabase."
        );
    }
}

// Log out.
async function logout() {
    const { error } = await campusSupabase.auth.signOut();

    if (error) {
        alert("Logout failed: " + error.message);
        return;
    }

    window.location.href = "login.html";
}

document.querySelectorAll("#logoutButton").forEach(button => {
    button.addEventListener("click", logout);
});

// LOGIN AND SIGNUP PAGE
async function setupLogin() {
    const emailInput = document.getElementById("authEmail");
    const passwordInput = document.getElementById("authPassword");
    const nameInput = document.getElementById("authName");
    const message = document.getElementById("authMessage");
    const loginButton = document.getElementById("loginButton");
    const signupButton = document.getElementById("signupButton");

    if (!emailInput || !passwordInput || !message) return;

    // If already logged in, redirect according to role.
    const { data: sessionData, error: sessionError } =
        await campusSupabase.auth.getSession();

    if (sessionError) {
        console.error("Session error:", sessionError.message);
    }

    if (sessionData?.session) {
        await redirectByRole(sessionData.session.user.id);
        return;
    }

    // SIGNUP
    if (signupButton) {
        signupButton.addEventListener("click", async () => {
            const fullName = nameInput?.value.trim() || "";
            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!fullName || !email || password.length < 8) {
                message.textContent =
                    "Enter your name, email, and a password " +
                    "of at least 8 characters.";
                return;
            }

            message.textContent = "Creating your account...";
            signupButton.disabled = true;

            const { data, error } =
                await campusSupabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName
                        }
                    }
                });

            signupButton.disabled = false;

            if (error) {
                message.textContent = error.message;
                return;
            }

            if (data.session) {
                // New accounts are students by default.
                window.location.href = "index.html";
            } else {
                message.textContent =
                    "Account created! Check your email to confirm it, " +
                    "then log in.";
            }
        });
    }

    // LOGIN
    if (loginButton) {
        loginButton.addEventListener("click", async () => {
            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || !password) {
                message.textContent =
                    "Please enter your email and password.";
                return;
            }

            message.textContent = "Logging in...";
            loginButton.disabled = true;

            const { data, error } =
                await campusSupabase.auth.signInWithPassword({
                    email,
                    password
                });

            loginButton.disabled = false;

            if (error) {
                message.textContent = error.message;
                return;
            }

            message.textContent = "Login successful. Redirecting...";

            await redirectByRole(data.user.id);
        });
    }
}

// STUDENT DASHBOARD
async function setupDashboard() {
    if (currentPage !== "index.html") return;

    const session = await requireLogin();
    if (!session) return;

    // Prevent admins from using the student dashboard.
    const role = await getUserRole(session.user.id);

    if (role === "admin") {
        window.location.href = "admin.html";
        return;
    }

    if (role !== "student") {
        alert("Your account role could not be verified.");
        await campusSupabase.auth.signOut();
        window.location.href = "login.html";
        return;
    }

    const emailElement = document.getElementById("studentEmail");

    if (emailElement) {
        emailElement.textContent =
            session.user.email || "Welcome back!";
    }

    const nameElement =
        document.querySelector(".user-profile strong");

    const { data: profile, error: profileError } =
        await campusSupabase
            .from("profiles")
            .select("full_name")
            .eq("id", session.user.id)
            .maybeSingle();

    if (profileError) {
        console.error("Loading profile failed:", profileError.message);
    }

    if (nameElement && profile?.full_name) {
        nameElement.textContent = profile.full_name;
    }

    const list = document.getElementById("complaintList");
    if (!list) return;

    const { data: complaints, error } = await campusSupabase
        .from("complaints")
        .select("id,title,category,location,status,created_at")
        .eq("student_id", session.user.id)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Loading complaints failed:", error.message);
        list.textContent =
            "Could not load complaints. Please refresh.";
        return;
    }

    list.innerHTML = "";

    if (!complaints || complaints.length === 0) {
        list.textContent =
            "No complaints yet. Report your first issue!";
    } else {
        complaints.forEach(complaint => {
            const article = document.createElement("article");
            article.className = "complaint";

            const icon = document.createElement("div");
            icon.className = "complaint-icon blue-icon";
            icon.textContent = "▤";

            const info = document.createElement("div");
            info.className = "complaint-info";

            const title = document.createElement("h3");
            title.textContent = complaint.title;

            const details = document.createElement("p");
            details.textContent =
                `${complaint.category} · ${complaint.location}`;

            info.append(title, details);

            const status = document.createElement("span");
            status.textContent = complaint.status || "Pending";

            status.className =
                "status " +
                (complaint.status === "Resolved"
                    ? "resolved"
                    : complaint.status === "In Progress"
                    ? "in-progress"
                    : "pending");

            article.append(icon, info, status);
            list.appendChild(article);
        });
    }

    const count = status =>
        (complaints || []).filter(
            item => item.status === status
        ).length;

    const totalElement = document.getElementById("totalCount");
    const pendingElement = document.getElementById("pendingCount");
    const progressElement = document.getElementById("progressCount");
    const resolvedElement = document.getElementById("resolvedCount");

    if (totalElement) {
        totalElement.textContent =
            String((complaints || []).length).padStart(2, "0");
    }

    if (pendingElement) {
        pendingElement.textContent =
            String(count("Pending")).padStart(2, "0");
    }

    if (progressElement) {
        progressElement.textContent =
            String(count("In Progress")).padStart(2, "0");
    }

    if (resolvedElement) {
        resolvedElement.textContent =
            String(count("Resolved")).padStart(2, "0");
    }
}

// COMPLAINT PAGE
async function setupComplaint() {
    if (currentPage !== "complaint.html") return;

    const session = await requireLogin();
    if (!session) return;

    // Only students should submit complaints.
    const role = await getUserRole(session.user.id);

    if (role === "admin") {
        window.location.href = "admin.html";
        return;
    }

    if (role !== "student") {
        alert("Your account role could not be verified.");
        await campusSupabase.auth.signOut();
        window.location.href = "login.html";
        return;
    }

    const form = document.getElementById("complaintForm");
    if (!form) return;

    const message = document.getElementById("formMessage");
    const submitButton =
        document.getElementById("submitComplaint");

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const title =
            document.getElementById("title").value.trim();

        const category =
            document.getElementById("category").value;

        const location =
            document.getElementById("location").value.trim();

        const description =
            document.getElementById("description").value.trim();

        const photo =
            document.getElementById("photo").files[0];

        if (photo && !photo.type.startsWith("image/")) {
            message.textContent =
                "Please select an image file.";
            return;
        }

        if (photo && photo.size > 5 * 1024 * 1024) {
            message.textContent =
                "Image must be smaller than 5 MB.";
            return;
        }

        submitButton.disabled = true;
        message.textContent = "Submitting complaint...";

        const { error } = await campusSupabase
            .from("complaints")
            .insert({
                student_id: session.user.id,
                title,
                category,
                location,
                description,
                status: "Pending",
                priority: "Low",
                image_url: null
            });

        submitButton.disabled = false;

        if (error) {
            console.error("Submission failed:", error.message);
            message.textContent =
                "Submission failed: " + error.message;
            return;
        }

        message.textContent =
            "Complaint submitted successfully! " +
            "Returning to dashboard...";

        form.reset();

        setTimeout(() => {
            window.location.href = "index.html";
        }, 1200);
    });
}

// Start page functions.
setupLogin();
setupDashboard();
setupComplaint();
