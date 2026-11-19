/* MediChannel single-page application.
 *
 * The UI is a static HTML document; this file owns routing, data loading
 * and every dynamic DOM update. All remote data is rendered with
 * createElement/textContent so that a malicious value can never become
 * markup.
 */
(function () {
  "use strict";

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  const $ = (id) => document.getElementById(id);
  const views = Array.from(document.querySelectorAll("[data-view]"));
  const TZ = "Asia/Colombo";
  const ManagerUI = window.MCManager;

  const RB = {
    CUSTOMER: [
      "inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-sky-50 text-blue-700 border-sky-200",
      "Customer",
    ],
    DOCTOR: [
      "inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-teal-50 text-teal-900 border-teal-200",
      "Doctor",
    ],
    MANAGER: [
      "inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-yellow-100 text-yellow-900 border-yellow-200",
      "Manager",
    ],
    ADMIN: [
      "inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-red-100 text-red-900 border-red-200",
      "Admin",
    ],
  };

  const HOME = {
    CUSTOMER: "index",
    DOCTOR: "doctor",
    MANAGER: "manager-d",
    ADMIN: "admin",
  };

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  const ACL = {
    appointments: ["CUSTOMER"],
    consult: ["CUSTOMER", "DOCTOR"],
    doctor: ["DOCTOR"],
    manager: ["MANAGER"],
    admin: ["ADMIN"],
  };

  const AUTH = ["login", "register"];

  const APPT_STATUS = {
    BOOKED: ["Booked", "blue"],
    ARRIVED: ["Checked in", "green"],
    IN_CONSULTATION: ["In consultation", "sky"],
    COMPLETED: ["Completed", "green"],
    CANCELLED: ["Cancelled", "red"],
    NO_SHOW: ["No-show", "red"],
  };

  const SESSION_STATUS = {
    SCHEDULED: ["Scheduled", "slate"],
    OPEN: ["Open", "blue"],
    IN_PROGRESS: ["In progress", "green"],
    COMPLETED: ["Completed", "green"],
    CANCELLED: ["Cancelled", "red"],
  };

  const TONE = {
    blue: "bg-sky-50 text-blue-700 border-sky-200",
    sky: "bg-sky-50 text-blue-700 border-sky-200",
    green: "bg-green-50 text-green-800 border-green-200",
    red: "bg-red-100 text-red-900 border-red-200",
    orange: "bg-orange-50 text-orange-800 border-orange-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
  };

  const MAX_CHAT_LENGTH = 1000;
  const MAX_REASON_LENGTH = 500;
  const INTENT_KEY = "mc-booking-intent";

  let S = null;
  let flash = "";
  let wakePromise = null;
  let bootTimer = null;
  let activeView = null;
  let languageButton = null;

  const state = {
    notifications: [],
    notificationTimer: null,
    specialisationsLoaded: false,
    sessionsLoaded: false,
    sessionsLoading: false,
    sessions: [],
    sessionQueues: {},
    sessionQueuePoll: null,
    selectedSession: null,
    booking: null,
    appointments: [],
    appointmentsLoaded: false,
    pendingIntent: null,
    publicNoticesLoaded: false,
    publicNotices: [],
    adminNotices: [],
    doctor: {
      sessions: [],
      sessionsLoaded: false,
      sessionId: null,
      queue: null,
      selected: null,
      summary: null,
      queueTimer: null,
    },
    consult: {
      appointmentId: null,
      requestedId: null,
      appointment: null,
      summary: null,
      typingTimer: null,
      typingSentAt: 0,
      typingStopTimer: null,
      remoteTypingTimer: null,
      chatSub: null,
      typingSub: null,
      statusSub: null,
    },
    queueSub: null,
    sessionsSub: null,
    manager: {
      reception: [],
      receptionLoaded: false,
    },
  };

  // ---------------------------------------------------------------
  // Formatting helpers
  // ---------------------------------------------------------------

  function todayISO() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(
      new Date()
    );
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(String(value) + "T00:00:00");
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: TZ,
    }).format(date);
  }

  function formatTime(value) {
    if (!value) return "—";
    return String(value).slice(0, 5);
  }

  /**
   * Calendar date (YYYY-MM-DD) for timestamps and date-only values alike.
   * `formatDate` only accepts date-only strings, so full ISO timestamps must
   * not be passed to it.
   */
  function formatNoticeDate(value) {
    if (!value) return "";
    const text = String(value);
    const date = new Date(text.length === 10 ? text + "T00:00:00" : text);
    if (Number.isNaN(date.getTime())) return text.slice(0, 10);
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: TZ,
    }).format(date);
  }

  function formatDateTime(value) {
    if (!value) return "—";
    if (typeof value === "string" && value.length >= 16) {
      return (
        formatDate(value.slice(0, 10)) + " " + value.slice(11, 16)
      );
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: TZ,
    }).format(date);
  }

  function money(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "—";
    return "LKR " + amount.toLocaleString("en-LK", {
      maximumFractionDigits: 2,
    });
  }

  function referenceOf(value) {
    if (!value) return "—";
    return String(value).replace(/-/g, "").slice(0, 10).toUpperCase();
  }

  function titleCase(value) {
    return String(value || "")
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function doctorName(session) {
    const name = String(session && session.doctorName ? session.doctorName : "").trim();
    if (!name) return "Doctor";
    return /^dr\.?\s/i.test(name) ? name : "Dr. " + name;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function badge(label, tone) {
    return el(
      "span",
      "inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap " +
        (TONE[tone] || TONE.slate),
      label
    );
  }

  function appointmentBadge(status) {
    const entry = APPT_STATUS[status] || [titleCase(status) || "Unknown", "slate"];
    return badge(entry[0], entry[1]);
  }

  function setStatus(node, message, isError) {
    if (!node) return;
    node.textContent = message || "";
    node.hidden = !message;
    node.classList.toggle("text-bad", Boolean(isError));
    node.classList.toggle("text-slate2", !isError);
  }

  function preserveScroll(mutation) {
    const y = window.scrollY;
    mutation();
    requestAnimationFrame(() => {
      if (Math.abs(window.scrollY - y) > 0) window.scrollTo(0, y);
    });
  }

  function sessionStart(session) {
    if (!session || !session.sessionDate) return null;
    const date = new Date(
      session.sessionDate + "T" + (session.startTime || "00:00") + ":00"
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function bookingDeadline(session) {
    const start = sessionStart(session);
    if (!start) return null;
    const minutes = session.consultationType === "PHYSICAL" ? 60 : 30;
    return new Date(start.getTime() - minutes * 60000);
  }

  function bookingClosed(session) {
    const deadline = bookingDeadline(session);
    return deadline ? Date.now() >= deadline.getTime() : false;
  }

  // ---------------------------------------------------------------
  // Global messages, wake-up handling
  // ---------------------------------------------------------------

  function setAppMessage(message, tone) {
    const notice = $("app-session-warning");
    if (!notice) return;
    const styles = {
      warning:
        "fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100%-2rem)] rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg",
      success:
        "fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100%-2rem)] rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-lg",
      error:
        "fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100%-2rem)] rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 shadow-lg",
    };
    notice.className = styles[tone] || styles.warning;
    notice.textContent = message || "";
    notice.hidden = !message;
  }

  function setWakeMessage(message) {
    const status = $("backend-wake-status");
    if (!status) return;
    const label = status.querySelector("[data-wake-message]");
    if (label) label.textContent = message || "";
    status.hidden = !message;
  }

  function wakeBackend() {
    if (wakePromise) return wakePromise;

    wakePromise = (async () => {
      const delays = [3000, 6000, 10000, 15000, 20000];

      for (let attempt = 0; attempt <= delays.length; attempt++) {
        const slow = setTimeout(
          () => setWakeMessage("Connecting to the hospital service…"),
          2200
        );

        try {
          const response = await fetch("/api/backend/wake", {
            credentials: "same-origin",
            cache: "no-store",
          });

          if (response.ok) {
            setWakeMessage("");
            return true;
          }
        } catch {
          // Retry below.
        } finally {
          clearTimeout(slow);
        }

        setWakeMessage(
          attempt < 2
            ? "The hospital service is starting…"
            : "The hospital service is still starting. Thanks for waiting…"
        );

        if (attempt < delays.length) {
          await new Promise((resolve) =>
            setTimeout(resolve, delays[attempt])
          );
        }
      }

      setWakeMessage("The backend is still starting. Retry in a moment.");
      return false;
    })().finally(() => {
      wakePromise = null;
    });

    return wakePromise;
  }

  function isServiceUnavailable(error) {
    const status = Number(error && error.status);
    return status === 502 || status === 503 || status === 504;
  }

  /**
   * Retries a backend call once after waking the hosted service. Render-style
   * free tiers sleep when idle, so the first request can fail with a 502/503
   * even though the action will succeed a few seconds later.
   */
  async function callWithWakeRetry(task, options) {
    const settings = options || {};
    try {
      return await task();
    } catch (error) {
      if (!isServiceUnavailable(error)) throw error;
      const awake = await wakeBackend();
      if (!awake) {
        throw new Error(
          "The hospital service is still starting. Please wait a moment and try again."
        );
      }
      if (!settings.retry) {
        throw new Error(
          "The hospital service was starting up. Please try that action again."
        );
      }
      return task();
    }
  }

  // ---------------------------------------------------------------
  // Routing and panels
  // ---------------------------------------------------------------

  function parseHash() {
    const raw = decodeURIComponent(location.hash.slice(1));
    let id = raw || "welcome";
    let panel = "";
    let consultId = null;

    if (id.startsWith("consult-") && id.length > 8) {
      consultId = id.slice(8);
      id = "consult";
    }

    const candidate = document.getElementById(id);

    if (
      candidate &&
      candidate.matches("[data-dashboard-panel]") &&
      candidate.closest("section[data-view]")
    ) {
      panel = id;
      id = candidate.closest("section[data-view]").dataset.view;
    }

    return { id, panel, consultId };
  }

  function resolveView(target) {
    let id = target.id;

    if (!views.some((view) => view.dataset.view === id)) id = "welcome";

    if (id === "index" && S && ["DOCTOR", "MANAGER", "ADMIN"].includes(S.role)) {
      return {
        id: HOME[S.role] || "welcome",
        panel: "",
        consultId: null,
      };
    }

    const allowed = ACL[id];

    if (allowed && !(S && allowed.includes(S.role))) {
      return {
        id: S ? HOME[S.role] || "welcome" : "login",
        panel: "",
        consultId: null,
      };
    }

    if (S && AUTH.includes(id)) {
      return { id: HOME[S.role] || "welcome", panel: "", consultId: null };
    }

    return { id, panel: target.panel, consultId: target.consultId };
  }

  function setPanel(view, panelId) {
    if (!view || !panelId) return false;

    const target = document.getElementById(panelId);

    if (
      !target ||
      !view.contains(target) ||
      !target.matches("[data-dashboard-panel]")
    ) {
      return false;
    }

    const y = window.scrollY;

    view.querySelectorAll("[data-dashboard-panel]").forEach((panel) => {
      panel.hidden = panel !== target;
    });

    view.querySelectorAll("[data-panel-link]").forEach((link) => {
      const isCurrent = link.getAttribute("href") === "#" + panelId;
      if (isCurrent) {
        link.setAttribute("aria-current", "page");
        if (link.closest("nav[aria-label='Pages']")) {
          link.classList.remove("text-slate2", "hover:bg-snow");
          link.classList.add("bg-brand", "text-white");
        }
      } else {
        link.removeAttribute("aria-current");
        if (link.closest("nav[aria-label='Pages']")) {
          link.classList.remove("bg-brand", "text-white");
          link.classList.add("text-slate2", "hover:bg-snow");
        }
      }
    });

    requestAnimationFrame(() => window.scrollTo(0, y));
    return true;
  }

  function activatePanel(view, link) {
    if (!view || !link) return;
    if (!setPanel(view, link.hash.slice(1))) return;

    try {
      history.replaceState(null, "", link.hash);
    } catch {
      // Ignore history failures (for example in private modes).
    }

    if (link.hash === "#doctor-n") {
      void loadDoctorNotesPicker();
    }

    if (link.hash === "#admin-u" || link.hash === "#manager-u" || link.hash === "#admin" || link.hash === "#manager") {
      void loadStaffAccounts();
    }

    if (link.hash === "#admin-d" || link.hash === "#admin") {
      void loadAdminStats();
    }

    if (link.hash === "#admin-a" || link.hash === "#admin") {
      void loadAuditLogs();
    }

    if (link.hash === "#admin-r" || link.hash === "#admin") {
      void loadAdminRooms();
    }

    if (link.hash === "#manager-s" || link.hash === "#manager-d" || link.hash === "#manager") {
      void loadManagerSessionPicker();
      void loadManagerSessions();
    }

    if (link.hash === "#manager-r" || link.hash === "#manager") {
      void loadManagerReception();
    }

    if (link.hash === "#manager-x") {
      void loadManagerReviews();
    }

    if (link.hash === "#admin-n") {
      void loadAdminNotices();
    }
  }

  function initPanels(view, requestedPanel) {
    if (!view) return;

    if (view.dataset.view === "admin") {
      ensureAdminNoticesPanel();
    }

    const panels = Array.from(
      view.querySelectorAll("[data-dashboard-panel]")
    );

    if (!panels.length) return;

    const currentLink = view.querySelector(
      '[data-panel-link][aria-current="page"]'
    );

    const currentPanel = currentLink
      ? panels.find(
          (panel) => "#" + panel.id === currentLink.getAttribute("href")
        )
      : null;

    const active =
      (requestedPanel && panels.find((panel) => panel.id === requestedPanel)) ||
      currentPanel ||
      panels[0];

    panels.forEach((panel) => {
      panel.hidden = panel !== active;
    });

    view.querySelectorAll("[data-panel-link]").forEach((link) => {
      const isCurrent = link.getAttribute("href") === "#" + active.id;
      if (isCurrent) {
        link.setAttribute("aria-current", "page");
        if (link.closest("nav[aria-label='Pages']")) {
          link.classList.remove("text-slate2", "hover:bg-snow");
          link.classList.add("bg-brand", "text-white");
        }
      } else {
        link.removeAttribute("aria-current");
        if (link.closest("nav[aria-label='Pages']")) {
          link.classList.remove("bg-brand", "text-white");
          link.classList.add("text-slate2", "hover:bg-snow");
        }
      }
    });

    if (active.id === "doctor-n") {
      void loadDoctorNotesPicker();
    }

    if (active.id === "admin-u" || active.id === "manager-u") {
      void loadStaffAccounts();
    }

    if (active.id === "admin-d" || active.id === "admin") {
      void loadAdminStats();
    }

    if (active.id === "admin-a" || active.id === "admin") {
      void loadAuditLogs();
    }

    if (active.id === "admin-r" || active.id === "admin") {
      void loadAdminRooms();
    }

    if (active.id === "manager-s" || active.id === "manager-d") {
      void loadManagerSessionPicker();
      void loadManagerSessions();
    }

    if (active.id === "manager-r" || active.id === "manager") {
      void loadManagerReception();
    }

    if (active.id === "manager-x") {
      void loadManagerReviews();
    }

    if (active.id === "admin-n") {
      void loadAdminNotices();
    }
  }

  function showView(id, panel, options) {
    const settings = options || {};
    const view = views.find((item) => item.dataset.view === id) || views[0];
    if (!view) return;

    const targetId = view.dataset.view;
    const changed = activeView !== targetId;

    if (changed) {
      if (activeView === "doctor" && state.doctor.pollTimer) {
        clearInterval(state.doctor.pollTimer);
        state.doctor.pollTimer = null;
      }
      if (activeView === "appointments" && state.patientPollTimer) {
        clearInterval(state.patientPollTimer);
        state.patientPollTimer = null;
      }
      if (activeView === "index") {
        stopSessionQueuePolling();
      }

      views.forEach((item) => {
        item.hidden = item !== view;
      });

      activeView = targetId;

      initPanels(view, panel);

      document.title = L(view.dataset.title) + " · MediChannel";

      const footer = document.querySelector("footer");
      if (footer) {
        footer.hidden = ["login", "register"].includes(targetId);
      }

      if (targetId === "login" && flash) {
        const success = $("login-ok");
        if (success) {
          success.textContent = flash;
          success.hidden = false;
        }
        flash = "";
      }

      window.scrollTo(0, 0);
    } else if (panel) {
      setPanel(view, panel);
    }

    if (changed || settings.force) {
      enterView(targetId);
    }
  }

  function go(options) {
    const settings = options || {};
    const target = resolveView(parseHash());
    showView(target.id, target.panel, settings);

    if (target.consultId) {
      state.consult.requestedId = target.consultId;
    }
  }

  function nav(id) {
    if (location.hash === "#" + id) {
      go({ force: true });
      return;
    }
    location.hash = id;
  }

  function enterView(id) {
    if (id === "index") {
      void prepareSearch();
      return;
    }

    if (id === "appointments") {
      void loadAppointments();
      if (!state.patientPollTimer) {
        state.patientPollTimer = setInterval(() => {
          if (activeView === "appointments") void loadAppointments();
        }, 5000);
      }
    } else if (id === "doctor") {
      void loadDoctorConsole();
      if (!state.doctor.pollTimer) {
        state.doctor.pollTimer = setInterval(() => {
          if (activeView === "doctor" && state.doctor.sessionId) {
            void loadDoctorQueue(state.doctor.sessionId, { silent: true });
          }
        }, 5000);
      }
    } else if (id === "consult") {
      void loadConsultationPicker();
    } else if (id === "admin") {
      ensureAdminNoticesPanel();
      void loadAdminSpecialisations();
      void loadStaffAccounts();
      void loadAdminRooms();
      void loadAdminStats();
      void loadAuditLogs();
      subscribeAdminAuditLogs();
      if (!state.auditLogTimer) {
        state.auditLogTimer = setInterval(() => {
          if (activeView === "admin") void loadAuditLogs();
        }, 6000);
      }
    } else if (id === "manager") {
      void loadStaffAccounts();
      void loadManagerSessionPicker();
      void loadManagerSessions();
    } else if (id === "welcome") {
      void loadPublicNotices();
    }

    if (id === "welcome") {
      void loadPublicNotices();
    }

    if (["welcome", "index", "appointments"].includes(id)) {
      if (S && S.role === "CUSTOMER") {
        void refreshPatientQueue();
      } else {
        hideQueue();
      }
    }
  }

  // ---------------------------------------------------------------
  // Account rendering
  // ---------------------------------------------------------------

  function render() {
    document.querySelectorAll("[data-who]").forEach((container) => {
      container.replaceChildren();

      if (S && RB[S.role]) {
        container.append(badge(RB[S.role][1], {
          CUSTOMER: "blue",
          DOCTOR: "green",
          MANAGER: "orange",
          ADMIN: "red",
        }[S.role]));

        const name = el(
          "span",
          "hidden max-w-[14rem] truncate sm:inline",
          S.email || "Signed in"
        );
        name.title = S.email || "";
        container.append(name);

        const out = el(
          "button",
          "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow hover:text-ink min-h-9 sm:min-h-8 px-2.5 py-1 text-xs",
          "Log out"
        );
        out.type = "button";
        out.dataset.out = "";
        container.append(out);
        return;
      }

      const loginLink = el(
        "a",
        "inline-flex items-center gap-1.5 border rounded-lg font-semibold bg-white border-line text-slate2 hover:bg-snow hover:text-ink min-h-9 sm:min-h-8 px-2.5 py-1 text-xs",
        "Log in"
      );
      loginLink.href = "#login";

      const registerLink = el(
        "a",
        "inline-flex items-center gap-1.5 border rounded-lg font-semibold bg-peach border-peach text-white hover:bg-peach-d min-h-9 sm:min-h-8 px-2.5 py-1 text-xs",
        "Register"
      );
      registerLink.href = "#register";

      container.append(loginLink, registerLink);
    });

    document.querySelectorAll("[data-roles]").forEach((link) => {
      const raw = link.getAttribute("data-roles") || link.dataset.roles || "*";
      const roles = String(raw).split(/\s+/);
      const isVisible =
        roles.includes("*") ||
        (!S && roles.includes("GUEST")) ||
        (S && roles.includes(S.role));
      link.hidden = !isVisible;
    });

    document.querySelectorAll("[data-guest-only]").forEach((item) => {
      item.hidden = Boolean(S);
    });

    document.querySelectorAll("[data-home-dashboard]").forEach((link) => {
      const isStaff = S && ["DOCTOR", "MANAGER", "ADMIN"].includes(S.role);
      const home = isStaff ? HOME[S.role] : null;
      link.hidden = !home;
      if (home) link.href = "#" + home;
    });
  }

  function setSession(user) {
    if (!user || !HOME[user.role]) {
      S = null;
      try { localStorage.removeItem("mc-active-user"); } catch {}
      try { sessionStorage.removeItem("mc_tab_user"); sessionStorage.removeItem("mc_tab_token"); } catch {}
      if (state.doctor.pollTimer) clearInterval(state.doctor.pollTimer);
      state.doctor.pollTimer = null;
      if (state.patientPollTimer) clearInterval(state.patientPollTimer);
      state.patientPollTimer = null;
      if (state.notificationTimer) clearInterval(state.notificationTimer);
      state.notificationTimer = null;
      state.notifications = [];
      renderNotificationBadge(0);
      return;
    }

    try {
      localStorage.setItem("mc-active-user", JSON.stringify({ email: user.email, role: user.role }));
    } catch {}
    try {
      sessionStorage.setItem("mc_tab_user", JSON.stringify(user));
    } catch {}

    state.consult.appointmentId = null;
    state.consult.requestedId = null;
    state.consult.appointment = null;
    state.consult.summary = null;
    state.consult.list = [];

    S = {
      id: user.id || user.userId || null,
      role: user.role,
      email: user.email || "Signed in",
      name: user.email || "Signed in",
    };
    if (state.notificationTimer) clearInterval(state.notificationTimer);
    subscribe("private-notifications", "/user/queue/notifications", handleIncomingNotification);
    state.notificationTimer = setInterval(loadNotifications, 15000);
    void loadNotifications();
  }

  function handleSessionExpired() {
    S = null;
    if (state.doctor.pollTimer) clearInterval(state.doctor.pollTimer);
    state.doctor.pollTimer = null;
    if (state.patientPollTimer) clearInterval(state.patientPollTimer);
    state.patientPollTimer = null;
    if (state.notificationTimer) clearInterval(state.notificationTimer);
    state.notificationTimer = null;
    disconnectRealtime();
    render();
    hideQueue();
    setAppMessage("Your session expired. Please sign in again.");
    nav("login");
  }

  window.addEventListener("storage", (event) => {
    if (event.key === "mc-active-user" && event.newValue) {
      try {
        const active = JSON.parse(event.newValue);
        if (S && active && active.email && active.email.toLowerCase() !== (S.email || "").toLowerCase()) {
          setAppMessage(
            `⚠️ Multi-tab session conflict: You signed into "${active.email}" in another tab. Browsers share session cookies across all tabs, so actions in this tab will fail. To use two accounts simultaneously, please open the second user in an Incognito / Private window.`
          );
        }
      } catch {}
    }
  });

  // ---------------------------------------------------------------
  // Booking intent (login gate with return)
  // ---------------------------------------------------------------

  function saveIntent(session, reason) {
    const intent = {
      sessionId: session && session.sessionId,
      session: session || null,
      reason: reason || "",
    };

    state.pendingIntent = intent;

    try {
      sessionStorage.setItem(INTENT_KEY, JSON.stringify(intent));
    } catch {
      // The in-memory copy still works for this page.
    }
  }

  function readIntent() {
    if (state.pendingIntent) return state.pendingIntent;

    try {
      const raw = sessionStorage.getItem(INTENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function clearIntent() {
    state.pendingIntent = null;
    try {
      sessionStorage.removeItem(INTENT_KEY);
    } catch {
      // Ignore storage failures.
    }
  }

  function applyIntent() {
    const intent = readIntent();
    if (!intent || !S || S.role !== "CUSTOMER") return;

    const session =
      (intent.sessionId &&
        state.sessions.find((item) => item.sessionId === intent.sessionId)) ||
      intent.session;

    if (session) {
      selectSession(session, { reason: intent.reason });
    }

    clearIntent();
  }

  // ---------------------------------------------------------------
  // Session search
  // ---------------------------------------------------------------

  async function loadSpecialisations() {
    const select = $("index-sp");
    if (!select || state.specialisationsLoaded) return;

    try {
      const list = await MC.specialisations();
      if (!Array.isArray(list)) throw new Error("Unexpected response");

      const current = select.value;
      select.replaceChildren(el("option", "", "All specialisations"));
      select.firstChild.value = "";

      list.forEach((item) => {
        const option = el("option", "", item.name);
        option.value = item.id;
        select.append(option);
      });

      if (current) select.value = current;
      state.specialisationsLoaded = true;
    } catch {
      // Search still works without the filter.
    }
  }

  async function prepareSearch() {
    const dateInput = $("index-dt");
    if (dateInput && !dateInput.value) dateInput.value = todayISO();

    enhanceIndexDashboard();
    await loadSpecialisations();

    if (S) subscribeSessionsCatalogue();

    if (!state.sessionsLoaded && !state.sessionsLoading) {
      await loadSessions();
    } else {
      renderSessions();
      if (activeView === "index") startSessionQueuePolling();
    }

    applyIntent();
  }

  function currentFilters() {
    const q = $("index-q");
    const specialisation = $("index-sp");
    const date = $("index-dt");
    const type = $("index-ty");

    return {
      q: q ? q.value.trim() : "",
      specialisationId: specialisation ? specialisation.value : "",
      date: date ? date.value : "",
      consultationType: type ? type.value : "",
    };
  }

  async function loadSessions() {
    if (state.sessionsLoading) return;

    const status = document.querySelector("[data-session-status]");
    const list = document.querySelector("[data-session-list]");
    const heading = document.querySelector("[data-session-heading]");
    const filters = currentFilters();

    state.sessionsLoading = true;

    if (status) {
      status.hidden = false;
      status.textContent = "Loading available sessions…";
      status.classList.remove("text-bad");
    }

    if (list) list.replaceChildren();

    try {
      let sessions = await MC.sessions(filters);
      if (!Array.isArray(sessions)) throw new Error("Unexpected response");

      let fallbackNotice = "";
      // If filtering by date returned 0 sessions, fall back to all upcoming sessions
      // so the patient is never stranded on an empty screen.
      if (sessions.length === 0 && filters.date) {
        try {
          const allUpcoming = await MC.sessions({ ...filters, date: "" });
          if (Array.isArray(allUpcoming) && allUpcoming.length > 0) {
            sessions = allUpcoming;
            fallbackNotice = `No sessions match for ${formatDate(filters.date)}. Showing all upcoming sessions:`;
          }
        } catch {
          // keep original empty sessions
        }
      }

      state.sessions = sessions;
      state.sessionsLoaded = true;

      if (heading) {
        if (fallbackNotice) {
          heading.textContent = fallbackNotice;
        } else {
          const day = filters.date ? formatDate(filters.date) : "all dates";
          heading.textContent =
            sessions.length +
            (sessions.length === 1 ? " session on " : " sessions on ") +
            day;
        }
      }

      if (status) {
        status.hidden = sessions.length > 0;
        status.textContent =
          sessions.length === 0
            ? "No sessions match these filters. Try another doctor, specialisation or date."
            : "";
      }

      renderSessions();
      if (activeView === "index") startSessionQueuePolling();
    } catch (error) {
      state.sessionsLoaded = false;
      if (heading) heading.textContent = "Sessions unavailable";
      if (status) {
        status.hidden = false;
        status.classList.add("text-bad");
        status.textContent = error.message;
      }
      if (list) list.replaceChildren();
    } finally {
      state.sessionsLoading = false;
    }
  }

  function handleIncomingNotification(notification) {
    if (!S || !notification || !notification.notificationId) return;
    const exists = state.notifications.some(
      (item) => item.notificationId === notification.notificationId
    );
    if (exists) return;

    state.notifications.unshift(notification);
    const unreadCount = state.notifications.filter((item) => !item.read).length;
    renderNotificationBadge(unreadCount);
    showNotificationToast(notification);

    if (S.role === "DOCTOR") {
      if (state.doctor.sessionId) {
        void loadDoctorQueue(state.doctor.sessionId, { silent: true });
      }
      void MC.doctorSessions().then((sessions) => {
        if (Array.isArray(sessions)) {
          state.doctor.sessions = sessions;
          const session = sessions.find((s) => s.sessionId === state.doctor.sessionId);
          if (session && state.doctor.queue) {
            renderDoctorHeader(session, state.doctor.queue);
          }
        }
      });
    } else if (S.role === "CUSTOMER") {
      void loadAppointments();
      void refreshPatientQueue();
    }
  }

  async function loadNotifications() {
    if (!S) return;
    try {
      const items = await MC.notifications();
      if (!Array.isArray(items)) return;
      const unread = items.filter((n) => !n.read);
      const isInitial = !state.notificationsLoaded;
      state.notificationsLoaded = true;
      const prevCount = (state.notifications || []).filter((n) => !n.read).length;
      state.notifications = items;
      if (!isInitial && unread.length > prevCount && unread.length > 0) {
        const latest = unread[0] || unread[unread.length - 1];
        showNotificationToast(latest);
        if (S && S.role === "DOCTOR" && state.doctor.sessionId) {
          void loadDoctorQueue(state.doctor.sessionId, { silent: true });
        }
      }
      renderNotificationBadge(unread.length);
    } catch (e) {
      // silently fail - notifications are non-critical
    }
  }

  function showNotificationToast(n) {
    if (!n) return;

    let container = document.getElementById("notification-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "notification-toast-container";
      container.className =
        "fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-[calc(100%-2rem)] pointer-events-none";
      document.body.append(container);
    }

    const toast = document.createElement("div");
    toast.className =
      "pointer-events-auto rounded-xl border border-line bg-white/95 p-3.5 shadow-xl backdrop-blur transition-all duration-200 transform translate-y-0 opacity-100 flex flex-col gap-1.5";
    toast.setAttribute("role", "alert");

    const header = document.createElement("div");
    header.className = "flex items-start justify-between gap-2";

    const titleWrap = document.createElement("div");
    titleWrap.className = "flex items-center gap-2";

    const dot = document.createElement("span");
    dot.className = "h-2 w-2 rounded-full bg-brand shrink-0";

    const title = document.createElement("b");
    title.className = "text-sm font-bold text-ink leading-tight";
    title.textContent = n.title || "Notification";

    titleWrap.append(dot, title);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close notification");
    closeBtn.className =
      "h-6 w-6 -mr-1 -mt-1 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-ink hover:bg-slate-100 transition-colors text-base font-bold cursor-pointer shrink-0";
    closeBtn.innerHTML = "&times;";

    let dismissTimer = null;

    const dismiss = () => {
      if (dismissTimer) clearTimeout(dismissTimer);
      toast.style.opacity = "0";
      toast.style.transform = "translateX(20px)";
      setTimeout(() => {
        try { toast.remove(); } catch {}
      }, 180);
    };

    closeBtn.onclick = (e) => {
      e.stopPropagation();
      dismiss();
    };

    header.append(titleWrap, closeBtn);
    toast.append(header);

    const msg = document.createElement("p");
    msg.className = "text-xs sm:text-sm text-slate2 leading-relaxed pl-4";
    msg.textContent = n.message || "";
    toast.append(msg);

    if (n.appointmentId) {
      const link = document.createElement("a");
      link.href = "#consult";
      link.className =
        "text-xs font-semibold text-brand hover:underline pl-4 mt-0.5 inline-flex items-center gap-1";
      link.textContent = "Open consultation →";
      link.onclick = () => dismiss();
      toast.append(link);
    }

    container.append(toast);

    dismissTimer = setTimeout(dismiss, 10000);
  }

  function renderNotificationBadge(count) {
    document.querySelectorAll("[data-notification-badge]").forEach((badge) => {
      if (count > 0) {
        badge.textContent = String(count);
        badge.hidden = false;
      } else {
        badge.textContent = "";
        badge.hidden = true;
      }
    });
  }

  function renderNotificationPopover(popover) {
    const list = popover.querySelector("[data-notification-list]");
    if (!list) return;

    const items = state.notifications || [];
    if (!items.length) {
      list.innerHTML = '<p class="text-xs text-mute py-4 text-center">No notifications</p>';
      return;
    }

    list.replaceChildren();
    items.forEach((n) => {
      const item = document.createElement("div");
      item.className = "p-2.5 rounded-lg border border-line bg-snow/50 flex flex-col gap-1 transition-colors hover:bg-snow" + (n.read ? " opacity-75" : " border-brand/40 bg-white shadow-xs");

      const header = document.createElement("div");
      header.className = "flex items-center justify-between text-xs";
      const title = document.createElement("b");
      title.className = n.read ? "text-slate2" : "text-brand font-bold";
      title.textContent = n.title || "Notification";

      const time = document.createElement("span");
      time.className = "text-[11px] text-mute";
      time.textContent = n.createdAt ? (new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })) : "";
      header.append(title, time);

      const msg = document.createElement("p");
      msg.className = "text-xs text-ink leading-snug";
      msg.textContent = n.message || "";

      item.append(header, msg);

      if (n.appointmentId) {
        const link = document.createElement("a");
        link.href = "#consult";
        link.className = "text-xs font-semibold text-brand hover:underline mt-0.5 inline-block";
        link.textContent = "Open consultation →";
        item.append(link);
      }

      list.append(item);
    });
  }

  function renderSessions() {
    const list = document.querySelector("[data-session-list]");
    if (!list) return;

    list.replaceChildren();

    if (!state.sessions.length) return;

    state.sessions.forEach((session) => {
      list.append(renderSessionCard(session));
    });
  }

  async function refreshSessionQueues() {
    const sessions = Array.isArray(state.sessions) ? state.sessions : [];
    if (!sessions.length) return;

    const relevant = sessions.filter(
      (session) => session && session.sessionId && session.status !== "CANCELLED"
    );
    if (!relevant.length) return;

    const results = await Promise.allSettled(
      relevant.map((session) => MC.sessionQueue(session.sessionId))
    );

    let changed = false;
    results.forEach((result, index) => {
      if (result.status !== "fulfilled" || !result.value) return;
      const session = relevant[index];
      state.sessionQueues[session.sessionId] = result.value;
      if (result.value.remainingAppointments != null) {
        session.remainingAppointments = result.value.remainingAppointments;
      }
      if (result.value.status) {
        session.status = result.value.status;
      }
      changed = true;
    });

    if (changed && activeView === "index") {
      preserveScroll(() => renderSessions());
    }
  }

  function startSessionQueuePolling() {
    stopSessionQueuePolling();
    void refreshSessionQueues();
    state.sessionQueuePoll = setInterval(() => {
      if (activeView === "index") {
        void refreshSessionQueues();
      }
    }, 15000);
  }

  function stopSessionQueuePolling() {
    if (state.sessionQueuePoll) {
      clearInterval(state.sessionQueuePoll);
      state.sessionQueuePoll = null;
    }
  }

  function samplePublicNotices() {
    const today = todayISO();
    return [
      {
        id: "sample-notice-1",
        title: "SAMPLE NOTICE: Live queue and appointment updates",
        body: "Demo content: Track each doctor’s session in real time on this dashboard. “Now serving” and spots left update as the clinic progresses so you can plan your arrival.",
        published: true,
        publishedAt: today + "T08:00:00",
        createdByName: "Demo (sample)",
        sample: true,
      },
      {
        id: "sample-notice-2",
        title: "SAMPLE NOTICE: Booking and check-in reminder",
        body: "Demo content: Arrive 10–15 minutes before your estimated time for physical visits. Online consultations open from your appointments when the doctor starts the session.",
        published: true,
        publishedAt: today + "T08:15:00",
        createdByName: "Demo (sample)",
        sample: true,
      },
      {
        id: "sample-notice-3",
        title: "SAMPLE NOTICE: Emergency and support",
        body: "Demo content: For medical emergencies call 1990 immediately. For appointment or payment assistance, contact hospital reception during OPD hours.",
        published: true,
        publishedAt: today + "T08:30:00",
        createdByName: "Demo (sample)",
        sample: true,
      },
    ];
  }

  function enhanceIndexDashboard() {
    const indexView = views.find((item) => item.dataset.view === "index");
    if (!indexView) return;

    const main = indexView.querySelector("main");
    const searchForm = indexView.querySelector('form[aria-label="Search sessions"]');
    let contentGrid = searchForm ? searchForm.nextElementSibling : null;
    const sessionsSection = indexView.querySelector('[aria-label="Sessions"]');
    const bookingAside = indexView.querySelector('[aria-label="Book session"]');
    const sessionList = indexView.querySelector("[data-session-list]");
    if (!main || !searchForm || !contentGrid || !sessionsSection || !bookingAside || !sessionList) return;

    // Remove notices panel from index/dashboard if present (notices live on welcome page)
    const existingNotices = indexView.querySelector("#public-notices-panel");
    if (existingNotices && existingNotices.parentNode) {
      existingNotices.parentNode.removeChild(existingNotices);
    }
    if (contentGrid && contentGrid.id === "public-notices-panel") {
      contentGrid = searchForm.nextElementSibling;
    }
    if (!contentGrid) return;

    // Normalize legacy dashboard structure (left notices column / wrappers)
    const legacyLeft = contentGrid.querySelector("[data-dashboard-left]");
    const legacyRight = contentGrid.querySelector("[data-dashboard-right]");
    if (legacyLeft || legacyRight) {
      if (legacyRight) {
        Array.from(legacyRight.children).forEach((child) => {
          contentGrid.append(child);
        });
      }
      if (legacyLeft) legacyLeft.remove();
      if (legacyRight) legacyRight.remove();
    }
    const legacyRow = contentGrid.querySelector("[data-booking-row]");
    if (legacyRow) {
      if (bookingAside.parentNode === legacyRow) contentGrid.append(bookingAside);
      legacyRow.remove();
    }

    // Full-size dashboard layout: doctors/sessions and booking occupy the available space
    main.className = "grid gap-5 max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8";
    searchForm.className =
      "bg-white/95 backdrop-blur border border-line rounded-2xl p-4 sm:p-6 shadow-sm grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 overflow-hidden";

    contentGrid.className = "grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(380px,1fr)] items-start";

    sessionsSection.className =
      "grid gap-4 rounded-2xl border border-line bg-white/80 p-4 sm:p-5 shadow-sm";
    sessionList.className = "grid gap-4 grid-cols-1 min-h-[320px]";

    bookingAside.className =
      "bg-white border border-brand/15 rounded-2xl p-4 sm:p-6 shadow-lg grid gap-4 overflow-hidden w-full xl:sticky xl:top-24";

    if (sessionsSection.parentNode !== contentGrid) contentGrid.append(sessionsSection);
    if (bookingAside.parentNode !== contentGrid) contentGrid.append(bookingAside);
    contentGrid.append(sessionsSection, bookingAside);
  }

  function ensurePublicNoticesPanel() {
    let panel = document.getElementById("public-notices-panel");

    const welcomeView = views.find((item) => item.dataset.view === "welcome");
    if (!welcomeView) return panel || null;

    const container =
      welcomeView.querySelector("main > div.max-w-\\[1360px\\]") ||
      welcomeView.querySelector("main > div.relative") ||
      welcomeView.querySelector("main > div");

    if (!panel) {
      panel = document.createElement("section");
      panel.id = "public-notices-panel";
      panel.className = "grid gap-5 py-2";
      panel.setAttribute("aria-label", "Hospital notices");

      const header = el("div", "flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between");
      const titleWrap = el("div", "grid gap-2");
      titleWrap.append(
        el("p", "text-sm font-semibold uppercase tracking-[0.18em] text-brand", "Hospital updates"),
        el("h2", "text-3xl sm:text-4xl font-bold text-ink", "Notices & announcements"),
        el("p", "text-base sm:text-lg text-slate2", "Published by hospital administration for patients and visitors.")
      );
      header.append(titleWrap);

      const status = el("p", "text-base sm:text-lg text-slate2", "Loading notices…");
      status.dataset.publicNoticesStatus = "";
      status.setAttribute("role", "status");
      const list = el("div", "grid gap-6");
      list.dataset.publicNoticesList = "";

      panel.append(header, status, list);
    } else {
      panel.className = "grid gap-5 py-2";
      panel.hidden = false;
      panel.style.display = "";
      const list = panel.querySelector("[data-public-notices-list]");
      if (list) list.className = "grid gap-6";
    }

    // Place notices prominently on the welcome page (before "How it works")
    if (container) {
      const howItWorksHeading = Array.from(container.querySelectorAll("h2")).find(
        (h) => (h.textContent || "").trim().toLowerCase() === "how it works"
      );
      const howItWorksAnchor = howItWorksHeading
        ? howItWorksHeading.closest("div.text-center") || howItWorksHeading.parentElement
        : null;
      const hero = container.children[0] || null;
      const queueCard = container.querySelector("[data-patient-queue-card]");
      const statsGrid = container.querySelector(".grid.grid-cols-3.rounded-2xl");
      let anchor = null;
      if (howItWorksAnchor && howItWorksAnchor.parentNode === container) {
        anchor = howItWorksAnchor;
      } else if (statsGrid && statsGrid.nextSibling) {
        anchor = statsGrid.nextSibling;
      }

      if (anchor) {
        if (panel.parentNode !== container || panel.nextSibling !== anchor) {
          container.insertBefore(panel, anchor);
        }
      } else if (queueCard && queueCard.nextSibling && queueCard.parentNode === container) {
        if (panel.parentNode !== container) container.insertBefore(panel, queueCard.nextSibling);
      } else if (hero && hero.nextSibling && hero.parentNode === container) {
        if (panel.parentNode !== container) container.insertBefore(panel, hero.nextSibling);
      } else if (panel.parentNode !== container) {
        container.prepend(panel);
      }
    }

    return panel;
  }

  function isHiddenPublicNotice(notice) {
    if (!notice) return true;
    const title = String(notice.title || "");
    const body = String(notice.body || "");
    const text = title + "\n" + body;
    // Hide obvious spam/junk floods (long runs of the same character), while
    // avoiding overly broad rules that could suppress legitimate notices.
    return /([A-Za-z0-9])\1{29,}/.test(text);
  }

  function renderPublicNotices(notices) {
    const panel = ensurePublicNoticesPanel();
    if (!panel) return;

    const status = panel.querySelector("[data-public-notices-status]");
    const list = panel.querySelector("[data-public-notices-list]");
    if (!list) return;

    list.className = "grid gap-6";
    list.replaceChildren();

    let published = (Array.isArray(notices) ? notices : []).filter(
      (notice) => notice && notice.published !== false && !isHiddenPublicNotice(notice)
    );
    let usingSample = false;
    if (!published.length) {
      published = samplePublicNotices();
      usingSample = true;
    }

    if (status) {
      status.hidden = false;
      status.className = "text-base sm:text-lg " + (usingSample ? "text-peach-d" : "text-slate2");
      status.textContent = usingSample
        ? "Showing SAMPLE NOTICES (demo content). Real published notices from hospital administration will appear here when available."
        : "Latest notices published by hospital administration.";
    }

    published.forEach((notice) => {
      const isSampleNotice = usingSample || Boolean(notice && notice.sample);
      const card = el(
        "article",
        "relative overflow-hidden rounded-lg border border-line bg-white shadow-sm transition-shadow hover:shadow-md"
      );

      const accent = el(
        "span",
        "pointer-events-none absolute inset-y-0 left-0 w-1.5 " +
          (isSampleNotice ? "bg-peach" : "bg-brand-d")
      );
      accent.setAttribute("aria-hidden", "true");
      card.append(accent);

      const inner = el(
        "div",
        "grid gap-3 py-5 pl-6 pr-5 sm:py-6 sm:pl-8 sm:pr-7"
      );

      const top = el(
        "div",
        "flex flex-wrap items-start justify-between gap-x-4 gap-y-2"
      );
      const badges = el("div", "flex flex-wrap items-center gap-2");
      if (isSampleNotice) {
        badges.append(
          el(
            "span",
            "inline-flex items-center rounded border border-peach/40 bg-peach/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-peach-d",
            "Sample notice"
          )
        );
      }

      const publishedOn = formatNoticeDate(notice.publishedAt || notice.createdAt);
      const updatedOn = formatNoticeDate(notice.updatedAt);
      const dates = el(
        "div",
        "ml-auto text-right text-xs leading-6 text-mute sm:text-sm"
      );
      if (publishedOn) dates.append(el("p", "", "Published: " + publishedOn));
      if (updatedOn && updatedOn !== publishedOn) {
        dates.append(el("p", "", "Updated: " + updatedOn));
      }
      top.append(badges, dates);
      inner.append(top);

      inner.append(
        el(
          "h3",
          "break-words text-xl font-bold leading-snug text-brand-d sm:text-[26px]",
          notice.title || "Hospital notice"
        )
      );

      if (notice.body) {
        inner.append(
          el(
            "p",
            "whitespace-pre-line break-words text-base leading-7 text-slate2 sm:text-[17px] sm:leading-8",
            notice.body
          )
        );
      }

      const footer = el(
        "div",
        "mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3"
      );
      const tags = el("div", "flex flex-wrap items-center gap-2");
      tags.append(
        el(
          "span",
          "inline-flex items-center rounded px-2.5 py-1 text-xs font-semibold " +
            (isSampleNotice
              ? "bg-peach/10 text-peach-d"
              : "bg-brand/10 text-brand-d"),
          isSampleNotice ? "Demo content" : "Hospital update"
        )
      );
      tags.append(
        el(
          "span",
          "inline-flex items-center rounded bg-snow px-2.5 py-1 text-xs font-semibold text-slate2",
          "Patients & visitors"
        )
      );
      footer.append(
        tags,
        el(
          "p",
          "text-sm font-bold text-ink",
          "By " + String(notice.createdByName || "Hospital administration")
        )
      );
      inner.append(footer);

      card.append(inner);
      list.append(card);
    });
  }

  async function loadPublicNotices(options) {
    const settings = options || {};
    if (state.publicNoticesLoaded && !settings.force) {
      renderPublicNotices(state.publicNotices);
      return;
    }

    try {
      const notices = await MC.notices();
      state.publicNotices = Array.isArray(notices) ? notices : [];
      state.publicNoticesLoaded = true;
      renderPublicNotices(state.publicNotices);
    } catch (error) {
      state.publicNotices = [];
      state.publicNoticesLoaded = true;
      renderPublicNotices([]);
    }
  }

  function renderSessionCard(session) {
    const card = el(
      "article",
      "bg-white border border-line rounded-lg p-4 sm:p-5 shadow-sm [&>h2]:mb-3 grid gap-4"
    );
    card.dataset.sessionCard = session.sessionId;

    const header = el(
      "div",
      "flex flex-wrap items-start gap-3 justify-between"
    );
    const names = el("div", "min-w-0");
    names.append(el("h2", "", doctorName(session)));
    names.append(
      el(
        "p",
        "text-mute",
        [
          session.specialisation || "General",
          session.roomNumber
            ? "Room " + session.roomNumber
            : "Video-free chat room",
        ].join(" · ")
      )
    );

    const typeBadge = badge(
      session.consultationType === "ONLINE" ? "Online" : "Physical",
      "blue"
    );
    const statusBadge = badge(
      session.status === "OPEN" ? "Available" : session.status === "IN_PROGRESS" ? "In progress" : session.status === "COMPLETED" ? "Completed" : session.status === "CANCELLED" ? "Cancelled" : "Not available",
      session.status === "OPEN" ? "green" : session.status === "IN_PROGRESS" ? "orange" : "slate"
    );

    const meta = el("div", "flex flex-wrap items-center gap-3");
    meta.append(
      el(
        "span",
        "",
        formatTime(session.startTime) + "–" + formatTime(session.endTime)
      ),
      el("span", "", formatDate(session.sessionDate)),
      el("b", "", money(session.feeLkr))
    );

    const queue = state.sessionQueues[session.sessionId] || null;
    const liveRemaining = queue && queue.remainingAppointments != null
      ? Math.max(0, Number(queue.remainingAppointments) || 0)
      : Math.max(0, Number(session.remainingAppointments) || 0);
    const liveCapacity = queue && queue.maxAppointments != null
      ? Math.max(1, Number(queue.maxAppointments) || 1)
      : Math.max(1, Number(session.maxAppointments) || 1);
    const percent = Math.round((liveRemaining / liveCapacity) * 100);

    const queueWrap = el("div", "flex flex-col items-start gap-1.5 text-sm");
    queueWrap.dataset.sessionQueueInfo = "";
    const nowServing = queue && queue.nowServing != null ? Number(queue.nowServing) : null;
    const nextNumber = queue && queue.nextNumber != null ? Number(queue.nextNumber) : null;
    const hasNowServing = nowServing != null && Number.isFinite(nowServing) && nowServing > 0;
    const hasNextNumber = nextNumber != null && Number.isFinite(nextNumber) && nextNumber > 0;

    if (session.status === "COMPLETED") {
      queueWrap.append(
        el("span", "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200", "Session completed")
      );
    } else if (session.status === "CANCELLED") {
      queueWrap.append(
        el("span", "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200", "Session cancelled")
      );
    } else if (hasNowServing) {
      const pill = el(
        "span",
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300"
      );
      const dot = el("span", "w-2 h-2 rounded-full bg-amber-500 animate-pulse", "");
      dot.setAttribute("aria-hidden", "true");
      pill.append(dot, document.createTextNode("Now serving #" + nowServing));
      queueWrap.append(pill);
      if (hasNextNumber && nextNumber !== nowServing) {
        queueWrap.append(
          el("span", "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200", "Next #" + nextNumber)
        );
      }
    } else if (session.status === "IN_PROGRESS") {
      queueWrap.append(
        el("span", "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200", hasNextNumber ? "In progress · Next #" + nextNumber : "Queue in progress")
      );
    } else if (session.status === "OPEN" || session.status === "SCHEDULED") {
      queueWrap.append(
        el("span", "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200", hasNextNumber ? "Next queue #" + nextNumber : "Queue not started")
      );
    } else if (hasNextNumber) {
      queueWrap.append(
        el("span", "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200", "Next #" + nextNumber)
      );
    } else {
      queueWrap.append(el("span", "text-xs text-mute", "Live queue unavailable"));
    }

    // Place queue numbers below the availability/status tag (not below time)
    const statusCol = el("div", "flex flex-col items-end gap-2");
    const badgeRow = el("div", "flex flex-wrap items-center justify-end gap-2");
    badgeRow.append(typeBadge, statusBadge);
    statusCol.append(badgeRow, queueWrap);
    header.append(names, statusCol);

    const capacityWrap = el("div");
    capacityWrap.dataset.sessionCapacity = "";
    const capacityLabels = el(
      "div",
      "flex flex-wrap items-center gap-3 justify-between text-xs"
    );
    capacityLabels.append(
      el("span", "live", "Spots left (live)"),
      el("b", "", liveRemaining + " of " + liveCapacity)
    );

    const bar = el("div", liveRemaining === 0 ? "bar w" : "bar");
    const fill = el("i");
    fill.style.width = percent + "%";
    bar.append(fill);
    capacityWrap.append(capacityLabels, bar);

    const footer = el(
      "div",
      "flex flex-wrap items-center gap-3 justify-between"
    );
    const deadline = bookingDeadline(session);
    const closed = bookingClosed(session);
    const full = liveRemaining <= 0;

    footer.append(
      el(
        "span",
        "text-xs text-mute",
        full
          ? "Session full"
          : closed
            ? "Booking closed for this session"
            : "Booking closes " +
              (deadline
                ? deadline.toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: TZ,
                  }) +
                  " (" +
                  (session.consultationType === "PHYSICAL" ? "1 h" : "30 min") +
                  " before)"
                : "before the session")
      )
    );

    const available = session.status === "OPEN";
    const book = el(
      "button",
      "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer disabled:bg-line disabled:border-line disabled:text-mute disabled:cursor-not-allowed bg-peach border-peach text-white hover:bg-peach-d min-h-10 px-3.5 py-2",
      !available ? "Not available" : full ? "No spots left" : closed ? "Booking closed" : "Book"
    );
    book.type = "button";
    book.dataset.bookSession = session.sessionId;
    book.disabled = !available || full || closed;
    footer.append(book);

    card.append(header, meta, capacityWrap, footer);
    return card;
  }

  function selectSession(session, options) {
    if (!session) return;

    const settings = options || {};
    state.selectedSession = session;
    state.booking = null;

    const title = document.querySelector("[data-booking-title]");
    const meta = document.querySelector("[data-booking-meta]");
    const form = document.querySelector("[data-booking-form]");
    const success = document.querySelector("[data-booking-success]");
    const note = document.querySelector("[data-booking-note]");
    const reason = $("index-rs");
    const error = document.querySelector("[data-booking-error]");

    if (title) title.textContent = "Book: " + doctorName(session);
    if (meta) {
      meta.textContent = [
        formatDate(session.sessionDate),
        formatTime(session.startTime),
        session.consultationType === "ONLINE" ? "Online" : "Physical",
        session.roomNumber ? "Room " + session.roomNumber : "Chat room",
        money(session.feeLkr),
      ].join(" · ");
    }

    if (form) form.hidden = false;
    if (success) success.hidden = true;
    if (error) {
      error.hidden = true;
      error.textContent = "";
    }

    if (note) {
      note.textContent =
        S && S.role === "CUSTOMER"
          ? "Your queue number is allocated as soon as you confirm."
          : S
            ? "Only patient accounts can book appointments."
            : "You will be asked to log in, then returned to this booking.";
    }

    if (reason && settings.reason) reason.value = settings.reason;

    const confirm = document.querySelector("[data-booking-confirm]");
    if (confirm) {
      confirm.disabled = Boolean(S && S.role !== "CUSTOMER");
    }

    const panel = document.querySelector('[aria-label="Book session"]');
    if (panel && panel.scrollIntoView) {
      panel.scrollIntoView({ block: "nearest" });
    }

    if (reason) reason.focus({ preventScroll: true });
  }

  async function confirmBooking() {
    const session = state.selectedSession;
    const error = document.querySelector("[data-booking-error]");
    const reasonInput = $("index-rs");
    const button = document.querySelector("[data-booking-confirm]");

    if (!session) return;

    const reason = reasonInput ? reasonInput.value.trim() : "";

    if (reason.length < 5) {
      if (error) {
        error.hidden = false;
        error.textContent = "Please tell us a little about why you’re visiting.";
      }
      return;
    }

    if (reason.length > MAX_REASON_LENGTH) {
      if (error) {
        error.hidden = false;
        error.textContent =
          "Please keep the reason under " + MAX_REASON_LENGTH + " characters.";
      }
      return;
    }

    if (!S) {
      saveIntent(session, reason);
      nav("login");
      return;
    }

    if (S.role !== "CUSTOMER") {
      if (error) {
        error.hidden = false;
        error.textContent = "Only patient accounts can book appointments.";
      }
      return;
    }

    // BR-04: One active appointment per patient per session
    const existingActive = (state.appointments || []).find(
      (a) => a.sessionId === session.sessionId && ["BOOKED", "ARRIVED", "IN_CONSULTATION"].includes(a.status)
    );
    if (existingActive) {
      if (error) {
        error.hidden = false;
        error.textContent = "You already have an active appointment (#" + existingActive.appointmentNumber + ") in this session (BR-04). A patient can have only one active appointment per session.";
      }
      return;
    }

    // BR-05: Booking deadline cutoff (1h physical, 30m online)
    if (bookingClosed(session)) {
      if (error) {
        error.hidden = false;
        error.textContent = "Booking has closed for this session (BR-05: closes 1 hour before physical sessions and 30 minutes before online sessions).";
      }
      return;
    }

    // BR-03: Session capacity check
    const remaining = Number(session.availableAppointments ?? session.remainingCapacity ?? 1);
    if (remaining <= 0) {
      if (error) {
        error.hidden = false;
        error.textContent = "This session is fully booked (BR-03).";
      }
      return;
    }

    if (button) button.disabled = true;

    try {
      const appointment = await MC.bookAppointment(
        session.sessionId,
        reason
      );

      state.booking = appointment;
      showBookingSuccess(appointment, session);
      clearIntent();
      await Promise.allSettled([
        loadAppointments(),
        loadSessions(),
      ]);
    } catch (problem) {
      if (error) {
        error.hidden = false;
        error.textContent = problem.message;
      }
    } finally {
      if (button) button.disabled = false;
    }
  }

  function showBookingSuccess(appointment, session) {
    const form = document.querySelector("[data-booking-form]");
    const success = document.querySelector("[data-booking-success]");
    const reference = document.querySelector("[data-booking-reference]");
    const number = document.querySelector("[data-booking-number]");
    const estimate = document.querySelector("[data-booking-estimate]");
    const message = document.querySelector("[data-booking-message]");
    const pay = document.querySelector("[data-booking-pay]");

    if (form) form.hidden = true;
    if (success) success.hidden = false;
    if (reference) reference.textContent = referenceOf(appointment.bookingReference);
    if (number) number.textContent = "#" + appointment.appointmentNumber;
    if (estimate) {
      estimate.textContent = appointment.estimatedConsultationTime
        ? formatDateTime(appointment.estimatedConsultationTime)
        : session
          ? formatTime(session.startTime)
          : "—";
    }

    if (message) {
      message.textContent =
        appointment.paymentStatus === "PAID"
          ? "Your payment is recorded. The doctor can start your consultation when you check in."
          : "Pay now so the doctor can start your consultation when you check in.";
    }

    if (pay) {
      pay.dataset.bookingPay = appointment.appointmentId;
      pay.hidden = appointment.paymentStatus === "PAID";
    }

    const goButton = document.querySelector("[data-booking-goto]");
    if (goButton) goButton.dataset.bookingGoto = "1";
  }

  async function payBooking(appointmentId) {
    const pay = document.querySelector("[data-booking-pay]");
    const message = document.querySelector("[data-booking-message]");

    if (pay) pay.disabled = true;

    try {
      await MC.pay(appointmentId, "CARD");
      if (message) message.textContent = "Paid by card. You’re ready when the doctor calls you.";
      if (pay) pay.hidden = true;
      await Promise.allSettled([loadAppointments(), refreshPatientQueue()]);
    } catch (error) {
      if (message) message.textContent = error.message;
      if (pay) pay.disabled = false;
    }
  }

  // ---------------------------------------------------------------
  // Patient appointments and queue
  // ---------------------------------------------------------------

  function hideQueue() {
    document.querySelectorAll("[data-patient-queue-card]").forEach((card) => {
      card.hidden = true;
    });
  }

  function activeAppointment(list) {
    const today = todayISO();

    return (list || [])
      .filter(
        (item) =>
          item &&
          item.sessionDate === today &&
          item.appointmentNumber &&
          ["BOOKED", "ARRIVED", "IN_CONSULTATION"].includes(item.status)
      )
      .sort((a, b) =>
        String(a.sessionStartTime || "").localeCompare(
          String(b.sessionStartTime || "")
        )
      )[0];
  }

  async function loadAppointments() {
    if (!S || S.role !== "CUSTOMER") {
      hideQueue();
      return;
    }

    const status = document.querySelector("[data-appointments-status]");
    const tbody = document.querySelector("[data-appointments-list]");
    const empty = document.querySelector("[data-appointments-empty]");

    if (status) {
      status.hidden = false;
      status.textContent = "Loading your appointments…";
      status.classList.remove("text-bad");
    }

    try {
      const list = await MC.myAppointments();
      if (!Array.isArray(list)) throw new Error("Unexpected response");

      state.appointments = list;
      state.appointmentsLoaded = true;
      renderAppointments(list);

      const acceptedAppt = list.find((a) => a.acceptanceStatus === "ACCEPTED" && ["BOOKED", "ARRIVED", "IN_CONSULTATION"].includes(a.status));
      let banner = document.querySelector("[data-accepted-banner]");
      if (acceptedAppt) {
        if (!banner) {
          banner = el("div", "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm flex items-center gap-3 mb-4");
          banner.setAttribute("data-accepted-banner", "");
          const apptView = document.querySelector("section[data-view='appointments'] main");
          if (apptView) apptView.prepend(banner);
        }
        const when = [formatDate(acceptedAppt.sessionDate), formatTime(acceptedAppt.sessionStartTime)].filter(Boolean).join(" at ");
        banner.innerHTML = '<span class="text-emerald-600 font-bold text-base">✓</span> <span><b>Appointment Confirmed:</b> The doctor has accepted your appointment on ' + escapeHtml(when) + '. Make sure to be ready on time.</span>';
        banner.hidden = false;
      } else if (banner) {
        banner.hidden = true;
      }
      if (status) status.hidden = true;
      if (empty) empty.hidden = list.length > 0;
      await refreshPatientQueue(list);
    } catch (error) {
      if (error.status === 401) {
        handleSessionExpired();
        return;
      }

      if (status) {
        status.hidden = false;
        status.classList.add("text-bad");
        status.textContent = error.message;
      }
      if (tbody) tbody.replaceChildren();
      if (empty) empty.hidden = true;
      hideQueue();
    }
  }

  function renderAppointments(list) {
    const tbody = document.querySelector("[data-appointments-list]");
    if (!tbody) return;

    tbody.replaceChildren();

    list.forEach((appointment) => {
      const row = document.createElement("tr");

      const cells = [
        [referenceOf(appointment.bookingReference), "Booking ref"],
        [appointment.doctorName ? doctorName(appointment) : "—", "Doctor"],
        [
          [
            formatDate(appointment.sessionDate),
            formatTime(appointment.sessionStartTime),
          ]
            .filter(Boolean)
            .join(" "),
          "When",
        ],
        [
          appointment.consultationType === "ONLINE" ? "Online" : "Physical",
          "Visit type",
        ],
      ];

      cells.forEach(([value, label]) => {
        const cell = document.createElement("td");
        cell.dataset.label = label;
        cell.textContent = String(value);
        row.append(cell);
      });

      const statusCell = document.createElement("td");
      statusCell.dataset.label = "Status";
      const statusWrap = document.createElement("div");
      statusWrap.className = "flex flex-col gap-1 items-start";
      statusWrap.append(appointmentBadge(appointment.status));
      if (appointment.acceptanceStatus === "ACCEPTED") {
        statusWrap.append(badge("Doctor Accepted", "green"));
      } else if (appointment.status === "BOOKED") {
        statusWrap.append(badge("Pending Acceptance", "orange"));
      }
      statusCell.append(statusWrap);
      row.append(statusCell);

      const paymentCell = document.createElement("td");
      paymentCell.dataset.label = "Payment";
      paymentCell.textContent =
        appointment.paymentStatus === "PAID"
          ? "Paid" +
            (appointment.paymentMethod
              ? " · " +
                appointment.paymentMethod.charAt(0) +
                appointment.paymentMethod.slice(1).toLowerCase()
              : "")
          : appointment.paymentStatus === "REFUNDED"
            ? "Refunded"
            : "Not paid yet";
      row.append(paymentCell);

      const actions = document.createElement("td");
      actions.dataset.label = "Actions";
      actions.className = "flex flex-wrap items-center justify-end gap-2";

      if (
        appointment.paymentStatus !== "PAID" &&
        ["BOOKED", "ARRIVED"].includes(appointment.status)
      ) {
        actions.append(
          actionButton(
            "Pay " + money(appointment.consultationFeeLkr),
            "bg-brand border-brand text-white hover:bg-brand-d",
            "pay-appointment",
            appointment.appointmentId
          )
        );
      }

      const isPhysical = appointment.consultationType === "PHYSICAL";
      if (isPhysical && appointment.status === "BOOKED" && appointment.paymentStatus === "PAID") {
        actions.append(
          actionButton(
            "Check in",
            "bg-white border-line text-slate2 hover:bg-snow",
            "checkin-appointment",
            appointment.appointmentId
          )
        );
      }

      if (
        appointment.acceptanceStatus === "ACCEPTED" ||
        ["IN_CONSULTATION", "COMPLETED", "BOOKED", "ARRIVED"].includes(appointment.status)
      ) {
        actions.append(
          actionButton(
            appointment.status === "COMPLETED"
              ? "Summary & feedback"
              : "Open chat",
            "bg-white border-brand text-brand hover:bg-snow font-semibold",
            "open-consult",
            appointment.appointmentId
          )
        );
      }

      if (appointment.status === "BOOKED" && appointment.paymentStatus === "PAID") {
        actions.append(
          el("span", "text-[11px] text-mute block leading-tight", "Paid (non-refundable)")
        );
      }

      actions.append(
        actionButton(
          "Cancel",
          "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100",
          "cancel-appointment",
          appointment.appointmentId
        )
      );

      row.append(actions);
      tbody.append(row);
    });
  }

  function canCancel(appointment) {
    if (!appointment.sessionDate) return false;
    const start = new Date(
      appointment.sessionDate +
        "T" +
        (appointment.sessionStartTime || "00:00") +
        ":00"
    );
    if (Number.isNaN(start.getTime())) return false;
    return Date.now() < start.getTime() - 3 * 60 * 60 * 1000;
  }

  function actionButton(label, tone, name, id) {
    const button = el(
      "button",
      "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer disabled:bg-line disabled:border-line disabled:text-mute disabled:cursor-not-allowed min-h-9 sm:min-h-8 px-2.5 py-1 text-xs " +
        tone,
      label
    );
    button.type = "button";
    // Firefox rejects hyphenated DOMStringMap keys, and several action
    // names such as "checkin-appointment" contain a hyphen. Convert
    // camelCase names the same way dataset would.
    button.setAttribute(
      "data-" + name.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase()),
      id
    );
    return button;
  }

  async function refreshPatientQueue(knownList) {
    if (!S || S.role !== "CUSTOMER") {
      hideQueue();
      return;
    }

    let list = knownList;

    if (!list) {
      try {
        list = state.appointments.length
          ? state.appointments
          : await MC.myAppointments();
        state.appointments = list;
      } catch (error) {
        if (error.status === 401) handleSessionExpired();
        hideQueue();
        return;
      }
    }

    const current = activeAppointment(list);

    if (!current) {
      hideQueue();
      unsubscribeQueue();
      return;
    }

    let summary = null;

    try {
      summary = await MC.sessionQueue(current.sessionId);
    } catch {
      summary = null;
    }

    if (!S || S.role !== "CUSTOMER") return;

    const number = current.appointmentNumber;

    document.querySelectorAll("[data-patient-queue-card]").forEach((card) => {
      card.querySelector("[data-queue-headline]").textContent =
        "You are number " + number;

      card.querySelector("[data-queue-number]").textContent = String(number);

      const parts = [
        doctorName(current),
        formatTime(current.sessionStartTime)
          ? "today at " + formatTime(current.sessionStartTime)
          : "",
        APPT_STATUS[current.status]
          ? APPT_STATUS[current.status][0]
          : titleCase(current.status),
      ].filter(Boolean);

      if (summary && summary.nowServing) {
        parts.push("Now serving #" + summary.nowServing);
        const ahead = Math.max(0, number - summary.nowServing);
        parts.push(
          ahead === 0 ? "You’re next" : ahead + (ahead === 1 ? " person ahead" : " people ahead")
        );
      } else if (current.status === "IN_CONSULTATION") {
        parts.push("Your consultation is in progress");
      }

      card.querySelector("[data-queue-details]").textContent =
        parts.join(" · ");

      card.hidden = false;
    });

    subscribeQueue(current.sessionId);
  }

  function subscribeQueue(sessionId) {
    if (!sessionId) return;

    const destination = "/topic/sessions/" + sessionId + "/queue";

    if (state.queueSub && state.queueSub.destination === destination) return;

    unsubscribeQueue();

    state.queueSub = subscribe(
      "patient-queue",
      destination,
      (payload) => {
        if (!payload) return;

        const cards = document.querySelectorAll("[data-patient-queue-card]");
        cards.forEach((card) => {
          const details = card.querySelector("[data-queue-details]");
          if (!details) return;
          if (payload.nowServing) {
            const current = activeAppointment(state.appointments);
            const number = current ? current.appointmentNumber : null;
            const base = details.textContent.split(" · Now serving")[0];
            details.textContent =
              base +
              " · Now serving #" +
              payload.nowServing +
              (number
                ? " · " +
                  (Math.max(0, number - payload.nowServing) === 0
                    ? "You’re next"
                    : Math.max(0, number - payload.nowServing) +
                      (Math.max(0, number - payload.nowServing) === 1
                        ? " person ahead"
                        : " people ahead"))
                : "");
          }
        });
      }
    );
  }

  function unsubscribeQueue() {
    if (state.queueSub) {
      unsubscribe("patient-queue");
      state.queueSub = null;
    }
  }

  function subscribeSessionsCatalogue() {
    if (!S || state.sessionsSub) return;

    state.sessionsSub = subscribe(
      "sessions-catalogue",
      "/topic/sessions",
      (payload) => {
        if (!payload || !state.sessions.length) return;
        const session = state.sessions.find(
          (item) => item.sessionId === payload.sessionId
        );
        if (!session) return;
        session.remainingAppointments = payload.remainingAppointments;
        session.status = payload.status;
        preserveScroll(() => renderSessions());
      }
    );
  }

  async function payAppointment(appointmentId, button) {
    if (!appointmentId) return;
    if (button) button.disabled = true;

    try {
      await MC.pay(appointmentId, "CARD");
      setAppMessage("");
      await loadAppointments();
      if (state.manager.receptionLoaded) {
        await loadManagerReception({ silent: true });
      }
    } catch (error) {
      setAppMessage(error.message);
      if (button) button.disabled = false;
    }
  }

  function confirmAppointmentCancel(appointmentId) {
    const notice = $("app-session-warning");
    if (!notice) return Promise.resolve(false);

    const appointment = (Array.isArray(state.appointments) ? state.appointments : [])
      .concat(Array.isArray(state.manager && state.manager.reception) ? state.manager.reception : [])
      .find((item) => item && String(item.appointmentId) === String(appointmentId));

    return new Promise((resolve) => {
      notice.hidden = false;
      notice.className =
        "fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100%-2rem)] rounded-lg border border-rose-200 bg-white px-4 py-3 text-sm text-ink shadow-lg";
      notice.replaceChildren();

      const wrap = el("div", "flex flex-wrap items-center gap-2 sm:gap-3");
      const message = appointment
        ? "Cancel appointment " +
          referenceOf(appointment.bookingReference) +
          (appointment.doctorName ? " with " + doctorName(appointment) : "") +
          "? This cannot be undone."
        : "Cancel this appointment? This cannot be undone.";
      wrap.append(el("span", "font-medium text-slate2", message));

      const yes = el(
        "button",
        "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-rose-600 border-rose-600 text-white hover:bg-rose-700 min-h-9 px-3 py-1.5 text-xs",
        "Yes"
      );
      yes.type = "button";
      const no = el(
        "button",
        "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow min-h-9 px-3 py-1.5 text-xs",
        "No"
      );
      no.type = "button";

      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        yes.disabled = true;
        no.disabled = true;
        notice.replaceChildren();
        notice.className =
          "fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100%-2rem)] rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-lg";
        notice.hidden = true;
        resolve(value);
      };

      yes.addEventListener("click", () => finish(true));
      no.addEventListener("click", () => finish(false));
      wrap.append(yes, no);
      notice.append(wrap);
    });
  }

  async function cancelAppointment(appointmentId) {
    const confirmed = await confirmAppointmentCancel(appointmentId);
    if (!confirmed) return;

    try {
      await MC.cancelAppointment(appointmentId);
      await Promise.allSettled([loadAppointments(), loadSessions()]);
      if (state.manager.receptionLoaded) {
        await loadManagerReception({ silent: true });
      }
      setAppMessage("Your appointment is cancelled successfully.", "success");
    } catch (error) {
      setAppMessage(error.message, "error");
    }
  }

  async function checkInAppointment(appointmentId) {
    try {
      await MC.checkIn(appointmentId);
      await loadAppointments();
    } catch (error) {
      setAppMessage(error.message);
    }
  }

  // ---------------------------------------------------------------
  // Real-time transport
  // ---------------------------------------------------------------

  let stompClient = null;
  let stompReady = null;
  let stompConnected = false;
  const subscriptions = new Map();

  async function getRealtime() {
    if (!S) throw new Error("Sign in to use live updates.");
    if (stompReady) return stompReady;

    stompReady = (async () => {
      const response = await fetch("/api/realtime/config", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const config = await response.json().catch(() => ({}));

      if (!response.ok || !config.websocketUrl) {
        throw new Error("Live updates are not configured.");
      }

      if (typeof StompJs === "undefined") {
        throw new Error("The live update library did not load.");
      }

      const client = new StompJs.Client({
        brokerURL: config.websocketUrl,
        reconnectDelay: 4000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        debug: () => {},
      });

      client.beforeConnect = async () => {
        const ticket = await MC.wsTicket();
        client.connectHeaders = {
          Authorization: "Bearer " + ticket.ticket,
        };
      };

      client.onConnect = () => {
        stompConnected = true;
        subscriptions.forEach((entry) => {
          if (entry.subscription) {
            try {
              entry.subscription.unsubscribe();
            } catch {
              // Ignore stale subscriptions.
            }
          }
          entry.subscription = client.subscribe(
            entry.destination,
            entry.handler
          );
        });
      };

      client.onWebSocketClose = () => {
        stompConnected = false;
      };

      client.onStompError = (frame) => {
        stompConnected = false;
        const message =
          (frame.headers && frame.headers.message) ||
          "Live updates are temporarily unavailable.";
        setAppMessage(message);
      };

      stompClient = client;
      client.activate();

      return client;
    })().catch((error) => {
      stompReady = null;
      throw error;
    });

    return stompReady;
  }

  function subscribe(key, destination, handler) {
    if (subscriptions.has(key)) {
      const existing = subscriptions.get(key);
      if (existing.destination === destination) return existing;
      unsubscribe(key);
    }

    const entry = {
      destination,
      handler: (message) => {
        let payload = null;
        try {
          payload = JSON.parse(message.body);
        } catch {
          return;
        }
        handler(payload);
      },
      subscription: null,
    };

    subscriptions.set(key, entry);

    if (stompConnected && stompClient) {
      entry.subscription = stompClient.subscribe(
        entry.destination,
        entry.handler
      );
    } else {
      void getRealtime().catch(() => {
        // The next successful connection registers this handler.
      });
    }

    return entry;
  }

  function unsubscribe(key) {
    const entry = subscriptions.get(key);
    if (!entry) return;

    if (entry.subscription) {
      try {
        entry.subscription.unsubscribe();
      } catch {
        // Ignore.
      }
    }

    subscriptions.delete(key);
  }

  function publish(destination, payload) {
    if (!stompConnected || !stompClient) {
      throw new Error("Live updates are not connected yet.");
    }

    stompClient.publish({
      destination,
      body: JSON.stringify(payload),
    });
  }

  function disconnectRealtime() {
    subscriptions.clear();
    stompConnected = false;

    if (stompClient) {
      try {
        void stompClient.deactivate();
      } catch {
        // Ignore.
      }
    }

    stompClient = null;
    stompReady = null;
    state.sessionsSub = null;
    state.queueSub = null;
  }

  // ---------------------------------------------------------------
  // Doctor console
  // ---------------------------------------------------------------

  async function loadDoctorConsole() {
    if (!S || S.role !== "DOCTOR") return;

    const select = $("doctor-session-select");
    const queueSelect = $("doctor-queue-session-select");
    const status = document.querySelector("[data-doctor-status]");
    const empty = document.querySelector("[data-doctor-empty]");

    if (status) setStatus(status, "Loading your sessions…");

    try {
      let sessions = await MC.doctorSessions();
      if (!Array.isArray(sessions)) sessions = [];

      // Sort sessions chronologically: upcoming/today first (ascending), past sessions last (descending)
      const todayStr = new Date().toISOString().slice(0, 10);
      sessions.sort((a, b) => {
        const aDate = a.sessionDate || "";
        const bDate = b.sessionDate || "";
        const aIsUpcoming = aDate >= todayStr;
        const bIsUpcoming = bDate >= todayStr;
        if (aIsUpcoming && !bIsUpcoming) return -1;
        if (!aIsUpcoming && bIsUpcoming) return 1;
        if (aIsUpcoming && bIsUpcoming) {
          if (aDate !== bDate) return aDate.localeCompare(bDate);
          return (a.startTime || "").localeCompare(b.startTime || "");
        }
        if (aDate !== bDate) return bDate.localeCompare(aDate);
        return (b.startTime || "").localeCompare(a.startTime || "");
      });

      state.doctor.sessions = sessions;
      state.doctor.sessionsLoaded = true;

      // Smart default: keep current if valid in list, else today's session, else first upcoming, else sessions[0]
      let defaultSession = sessions.find((s) => s.sessionId === state.doctor.sessionId);
      if (!defaultSession) {
        defaultSession = sessions.find((s) => s.sessionDate === todayStr);
      }
      if (!defaultSession) {
        defaultSession = sessions.find((s) => s.sessionDate >= todayStr);
      }
      if (!defaultSession && sessions.length > 0) {
        defaultSession = sessions[0];
      }

      const chosenSessionId = defaultSession ? defaultSession.sessionId : "";
      state.doctor.sessionId = chosenSessionId;

      const selects = [select, queueSelect].filter(Boolean);
      selects.forEach((sel) => {
        sel.replaceChildren();
        sessions.forEach((session) => {
          const option = el(
            "option",
            "",
            formatDate(session.sessionDate) +
              " · " +
              formatTime(session.startTime) +
              "–" +
              formatTime(session.endTime) +
              " · " +
              (session.consultationType === "ONLINE" ? "Online" : "Physical")
          );
          option.value = session.sessionId;
          sel.append(option);
        });
        sel.value = chosenSessionId;
      });

      if (!sessions.length) {
        if (empty) empty.hidden = false;
        const rows = document.querySelector("[data-doctor-rows]");
        if (rows) rows.replaceChildren();
        setStatus(status, "You have no sessions scheduled.");
        return;
      }

      if (empty) empty.hidden = true;

      await loadDoctorQueue(chosenSessionId);
      void loadDoctorNotesPicker();
    } catch (error) {
      if (error.status === 401) {
        handleSessionExpired();
        return;
      }
      setStatus(status, error.message, true);
    }
  }

  async function loadDoctorQueue(sessionId, options) {
    if (!sessionId) return;

    const settings = options || {};
    const statusNode = document.querySelector("[data-doctor-status]");
    const rows = document.querySelector("[data-doctor-rows]");
    const empty = document.querySelector("[data-doctor-empty]");

    if (!settings.silent && statusNode) {
      setStatus(statusNode, "Loading the queue…");
    }

    try {
      const queue = await MC.doctorQueue(sessionId);
      state.doctor.queue = queue;
      state.doctor.sessionId = sessionId;

      const selects = [$("doctor-session-select"), $("doctor-queue-session-select")].filter(Boolean);
      selects.forEach((sel) => {
        if (sel.value !== sessionId) sel.value = sessionId;
      });

      const session = state.doctor.sessions.find(
        (item) => item.sessionId === sessionId
      );

      renderDoctorHeader(session, queue);
      renderDoctorStats(queue);
      renderDoctorRows(queue, session);

      if (empty) empty.hidden = true;
      if (statusNode && !settings.silent) {
        setStatus(
          statusNode,
          queue.appointments.length
            ? ""
            : "No patients have booked this session yet."
        );
      }

      subscribe(
        "doctor-queue",
        "/topic/sessions/" + sessionId + "/queue",
        () => {
          if (state.doctor.queueTimer) return;
          state.doctor.queueTimer = setTimeout(() => {
            state.doctor.queueTimer = null;
            if (state.doctor.sessionId === sessionId) {
              void loadDoctorQueue(sessionId, { silent: true });
            }
          }, 350);
        }
      );
    } catch (error) {
      if (error.status === 401) {
        handleSessionExpired();
        return;
      }
      setStatus(statusNode, error.message, true);
      if (rows) rows.replaceChildren();
      if (empty) empty.hidden = false;
    }
  }

  function renderDoctorHeader(session, queue) {
    const title = document.querySelector("[data-doctor-session-title]");
    const meta = document.querySelector("[data-doctor-session-meta]");
    const statusBadge = document.querySelector("[data-doctor-session-status]");
    const queueLabel = document.querySelector("[data-doctor-queue-session-label]");

    if (title) {
      title.textContent = session
        ? doctorName(session) + " · " + (session.specialisation || "Clinic")
        : "Today’s sessions";
    }

    if (session) {
      const summaryText =
        formatDate(session.sessionDate) +
        " · " +
        formatTime(session.startTime) +
        "–" +
        formatTime(session.endTime) +
        " · " +
        (session.consultationType === "ONLINE"
          ? "Online"
          : session.roomNumber
            ? "Room " + session.roomNumber
            : "Physical");

      if (meta) {
        meta.textContent = summaryText + " · " + session.minutesPerPatient + " min per patient";
      }

      if (queueLabel) {
        queueLabel.textContent = summaryText;
      }
    }

    if (statusBadge) {
      const entry = SESSION_STATUS[queue.status] || [titleCase(queue.status), "slate"];
      statusBadge.className =
        "inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap " +
        (TONE[entry[1]] || TONE.slate);
      statusBadge.textContent = entry[0];
    }
  }

  function renderDoctorStats(queue) {
    const appointments = queue.appointments || [];

    const set = (selector, value) => {
      const node = document.querySelector(selector);
      if (node) node.textContent = value;
    };

    set("[data-stat-booked]", appointments.length);
    set(
      "[data-stat-completed]",
      appointments.filter((item) => item.status === "COMPLETED").length
    );
    set(
      "[data-stat-now]",
      queue.nowServing ? "#" + queue.nowServing : "—"
    );
    set(
      "[data-stat-waiting]",
      appointments.filter((item) => item.status === "ARRIVED").length
    );
  }

  function renderDoctorRows(queue, session) {
    const tbody = document.querySelector("[data-doctor-rows]");
    if (!tbody) return;

    tbody.replaceChildren();

    (queue.appointments || []).forEach((appointment) => {
      const row = document.createElement("tr");

      if (appointment.status === "IN_CONSULTATION") {
        row.className = "[&>td]:bg-sky-50";
      } else if (["CANCELLED", "NO_SHOW"].includes(appointment.status)) {
        row.className = "[&>td]:text-mute";
      }

      const number = document.createElement("td");
      number.dataset.label = "No.";
      number.append(el("b", "", "#" + appointment.appointmentNumber));
      row.append(number);

      const patient = document.createElement("td");
      patient.dataset.label = "Patient";
      patient.textContent = appointment.patientName || "Patient";
      row.append(patient);

      const type = document.createElement("td");
      type.dataset.label = "Type";
      type.textContent =
        appointment.consultationType === "ONLINE" ? "Online" : "Physical";
      row.append(type);

      const arrival = document.createElement("td");
      arrival.dataset.label = "Check-in";
      arrival.textContent = appointment.arrivedAt
        ? "Checked in " + formatDateTime(appointment.arrivedAt).slice(-5)
        : "Not arrived";
      row.append(arrival);

      const status = document.createElement("td");
      status.dataset.label = "Status";
      let entry = APPT_STATUS[appointment.status] || [titleCase(appointment.status), "slate"];

      if (
        appointment.status === "ARRIVED" &&
        queue.nextNumber &&
        appointment.appointmentNumber === queue.nextNumber
      ) {
        entry = ["Next", "orange"];
      }

      status.append(badge(entry[0], entry[1]));
      if (appointment.acceptanceStatus === "ACCEPTED") {
        status.append(badge("Accepted", "green"));
      } else if (appointment.status === "BOOKED") {
        status.append(badge("Pending", "orange"));
      }
      row.append(status);

      const payment = document.createElement("td");
      payment.dataset.label = "Payment";
      if (appointment.paymentStatus === "PAID") {
        payment.textContent =
          "Paid" +
          (appointment.paymentMethod
            ? " · " + titleCase(appointment.paymentMethod)
            : "");
      } else {
        payment.append(badge("Not paid", "orange"));
      }
      row.append(payment);

      const actions = document.createElement("td");
      actions.dataset.label = "Actions";
      actions.className = "flex flex-wrap items-center justify-end gap-2";

      if (appointment.status === "BOOKED") {
        if (appointment.acceptanceStatus !== "ACCEPTED") {
          actions.append(
            doctorAction(
              "✓ Accept",
              "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700",
              "accept",
              appointment.appointmentId
            ),
            doctorAction(
              "✕ Decline",
              "bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100",
              "decline",
              appointment.appointmentId
            )
          );
        } else {
          const isOnline = appointment.consultationType === "ONLINE" || (session && session.consultationType === "ONLINE");
          if (isOnline) {
            // Online consultation goes directly from BOOKED to IN_CONSULTATION (skips ARRIVED - BR-08)
            if (appointment.paymentStatus === "PAID") {
              actions.append(
                doctorAction(
                  "Start",
                  "bg-brand border-brand text-white hover:bg-brand-d",
                  "start",
                  appointment.appointmentId
                )
              );
            } else {
              actions.append(
                el("span", "text-xs font-semibold text-orange-800", "Payment pending")
              );
            }
            actions.append(
              doctorAction(
                "No-show",
                "bg-white border-line text-slate2 hover:bg-snow",
                "noshow",
                appointment.appointmentId
              )
            );
          } else {
            // Physical consultation: BOOKED -> ARRIVED (at reception / mark arrived)
            actions.append(
              doctorAction(
                "Mark arrived",
                "bg-white border-line text-slate2 hover:bg-snow",
                "arrive",
                appointment.appointmentId
              ),
              doctorAction(
                "No-show",
                "bg-white border-line text-slate2 hover:bg-snow",
                "noshow",
                appointment.appointmentId
              )
            );
          }
        }
      } else if (appointment.status === "ARRIVED") {
        if (appointment.paymentStatus === "PAID") {
          actions.append(
            doctorAction(
              "Start",
              "bg-brand border-brand text-white hover:bg-brand-d",
              "start",
              appointment.appointmentId
            )
          );
        } else {
          actions.append(
            el(
              "span",
              "text-xs font-semibold text-orange-800",
              "Collect payment first"
            )
          );
        }
        actions.append(
          doctorAction(
            "No-show",
            "bg-white border-line text-slate2 hover:bg-snow",
            "noshow",
            appointment.appointmentId
          )
        );
      } else if (appointment.status === "IN_CONSULTATION") {
        actions.append(
          doctorAction(
            "Complete",
            "bg-brand border-brand text-white hover:bg-brand-d",
            "complete",
            appointment.appointmentId
          ),
          doctorAction(
            "💬 Chat",
            "bg-white border-line text-brand font-semibold hover:bg-snow",
            "chat",
            appointment.appointmentId
          )
        );
      } else if (appointment.status === "COMPLETED") {
        actions.append(
          doctorAction(
            "Notes",
            "bg-white border-line text-slate2 hover:bg-snow",
            "notes",
            appointment.appointmentId
          ),
          doctorAction(
            "Chat",
            "bg-white border-line text-slate2 hover:bg-snow",
            "chat",
            appointment.appointmentId
          )
        );
      }

      if (!actions.childNodes.length) {
        actions.append(document.createTextNode("—"));
      }

      row.append(actions);
      tbody.append(row);
    });
  }

  function doctorAction(label, tone, name, id) {
    // data-doctor-action carries the action name; data-doctor-id keeps the
    // appointment id so the click handler can pass both to runDoctorAction().
    const button = actionButton(label, tone, "doctorAction", name);
    button.dataset.doctorId = id;
    return button;
  }

  function findDoctorAppointment(appointmentId) {
    const pools = [
      state.doctor.queue && state.doctor.queue.appointments,
      state.doctor.allAppointments,
      state.doctor.sessionAppointments,
      state.consult.list,
    ];
    for (const pool of pools) {
      if (!Array.isArray(pool)) continue;
      const match = pool.find(
        (item) => item && String(item.appointmentId) === String(appointmentId)
      );
      if (match) return match;
    }
    return null;
  }

  /**
   * Opening the chat is the doctor's signal that the online consultation room
   * may open. Start the appointment first (BR-09) so the patient's room unlocks
   * in real time, then continue to the chat window.
   */
  async function ensureDoctorConsultationStarted(appointmentOrId) {
    if (!S || S.role !== "DOCTOR") return;

    const appointment =
      typeof appointmentOrId === "string"
        ? findDoctorAppointment(appointmentOrId)
        : appointmentOrId;

    if (!appointment) return;
    if (!["BOOKED", "ARRIVED"].includes(appointment.status)) return;
    if (appointment.consultationType !== "ONLINE") return;
    if (appointment.paymentStatus !== "PAID") return;

    try {
      await callWithWakeRetry(
        () => MC.startConsultation(appointment.appointmentId),
        { retry: true }
      );
    } catch (error) {
      // A retry after a lost response can report "already started"; treat that
      // as success, otherwise surface why the room cannot open yet.
      if (!error || error.status !== 409) {
        if (!isServiceUnavailable(error)) setAppMessage(error.message);
        return;
      }
    }

    appointment.status = "IN_CONSULTATION";

    if (state.doctor.queue && Array.isArray(state.doctor.queue.appointments)) {
      const row = state.doctor.queue.appointments.find(
        (item) => String(item.appointmentId) === String(appointment.appointmentId)
      );
      if (row) row.status = "IN_CONSULTATION";
    }

    if (
      state.consult.appointment &&
      String(state.consult.appointment.appointmentId) ===
        String(appointment.appointmentId)
    ) {
      state.consult.appointment.status = "IN_CONSULTATION";
      renderConsultHeader(state.consult.appointment);
    }

    if (activeView === "doctor") {
      void loadDoctorQueue(state.doctor.sessionId);
    }
  }

  async function runDoctorAction(name, appointmentId, button) {
    if (button) button.disabled = true;

    const statusNode = document.querySelector("[data-doctor-status]");

    try {
      if (name === "accept") {
        await MC.acceptAppointment(appointmentId);
        setStatus(statusNode, "Appointment accepted. Patient has been notified.");
        await loadDoctorQueue(state.doctor.sessionId);
        return;
      } else if (name === "decline") {
        if (!window.confirm("Decline this appointment?")) {
          if (button) button.disabled = false;
          return;
        }
        await MC.declineAppointment(appointmentId);
        setStatus(statusNode, "Appointment declined.");
        await loadDoctorQueue(state.doctor.sessionId);
        return;
      } else if (name === "arrive") {
        await MC.markArrived(appointmentId);
        setStatus(statusNode, "Patient marked as arrived.");
      } else if (name === "start") {
        await MC.startConsultation(appointmentId);
        setStatus(statusNode, "Consultation started.");
        state.consult.requestedId = appointmentId;
        nav("consult");
        return;
      } else if (name === "complete") {
        const result = await MC.completeAndAdvance(appointmentId);

        if (result.paymentRequired) {
          setStatus(
            statusNode,
            "Consultation completed. The next patient has not paid yet — collect payment before starting.",
            true
          );
        } else if (result.next) {
          setStatus(
            statusNode,
            "Consultation completed. Now serving #" +
              result.next.appointmentNumber +
              "."
          );
        } else {
          setStatus(
            statusNode,
            "Consultation completed. Waiting for the next check-in."
          );
        }

        selectNotes(result.completed);
      } else if (name === "noshow") {
        await MC.markNoShow(appointmentId);
        setStatus(statusNode, "Appointment marked as a no-show.");
      } else if (name === "notes" || name === "chat") {
        if (button) button.disabled = false;
        if (name === "chat") {
          await ensureDoctorConsultationStarted(appointmentId);
          state.consult.requestedId = appointmentId;
          nav("consult");
          setTimeout(async () => {
            const select = $("consult-pick");
            if (select) select.value = appointmentId;
            await openConsultation(appointmentId);
            const chatSection = document.querySelector('section[aria-label="Chat"]');
            if (chatSection) {
              chatSection.scrollIntoView({ behavior: "smooth", block: "start" });
            }
            const chatInput = $("consult-c");
            if (chatInput && !chatInput.disabled) {
              chatInput.focus();
            }
          }, 150);
          return;
        }
        const queue = state.doctor.queue;
        const appointment = queue
          ? queue.appointments.find(
              (item) => item.appointmentId === appointmentId
            )
          : null;
        if (appointment) await selectNotes(appointment);
        return;
      }

      await loadDoctorQueue(state.doctor.sessionId, { silent: true });
    } catch (error) {
      setStatus(statusNode, error.message, true);
      if (button) button.disabled = false;
    }
  }

  async function loadDoctorNotesPicker(preselectedId) {
    if (!S || S.role !== "DOCTOR") return;
    const dateSelect = $("doctor-notes-date");
    const sessionSelect = $("doctor-notes-session");
    const pick = $("doctor-notes-pick");
    if (!pick) return;

    try {
      const [sessionsResp, appointmentsResp] = await Promise.allSettled([
        MC.doctorSessions(),
        MC.doctorAppointments({})
      ]);

      const allSessions = (sessionsResp.status === "fulfilled" && Array.isArray(sessionsResp.value))
        ? sessionsResp.value
        : [];
      const allAppointments = (appointmentsResp.status === "fulfilled" && Array.isArray(appointmentsResp.value))
        ? appointmentsResp.value
        : [];

      state.doctor.allSessions = allSessions;
      state.doctor.allAppointments = allAppointments;

      const dateSet = new Set();
      allSessions.forEach((s) => { if (s.sessionDate) dateSet.add(s.sessionDate); });
      allAppointments.forEach((a) => { if (a.sessionDate) dateSet.add(a.sessionDate); });

      const sortedDates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));

      if (dateSelect) {
        dateSelect.replaceChildren();
        if (!sortedDates.length) {
          const opt = el("option", "", "No dates available");
          opt.value = "";
          dateSelect.append(opt);
        } else {
          sortedDates.forEach((d) => {
            const opt = el("option", "", formatDate(d));
            opt.value = d;
            dateSelect.append(opt);
          });
        }
      }

      let targetApptId = preselectedId || (state.doctor.selected && state.doctor.selected.appointmentId);
      let targetAppt = targetApptId
        ? allAppointments.find((a) => a.appointmentId === targetApptId)
        : null;

      let activeDate = targetAppt && targetAppt.sessionDate
        ? targetAppt.sessionDate
        : (state.doctor.selectedDate || sortedDates[0] || "");

      if (dateSelect && activeDate) {
        dateSelect.value = activeDate;
      }

      await syncDoctorNotesSessions(activeDate, targetAppt ? targetAppt.sessionId : null, targetApptId);
    } catch (err) {
      console.warn("Could not load doctor notes picker:", err);
    }
  }

  async function syncDoctorNotesSessions(selectedDate, preselectedSessionId, preselectedApptId) {
    const sessionSelect = $("doctor-notes-session");
    const allSessions = state.doctor.allSessions || [];

    const dateSessions = selectedDate
      ? allSessions.filter((s) => s.sessionDate === selectedDate)
      : allSessions;

    if (sessionSelect) {
      sessionSelect.replaceChildren();
      if (!dateSessions.length) {
        const opt = el("option", "", "No sessions on this date");
        opt.value = "";
        sessionSelect.append(opt);
      } else {
        dateSessions.forEach((sess, idx) => {
          const num = "Session " + (idx + 1);
          const time = (sess.startTime ? sess.startTime.slice(0, 5) : "") +
            (sess.endTime ? " - " + sess.endTime.slice(0, 5) : "");
          const type = sess.consultationType === "ONLINE"
            ? "Online"
            : (sess.roomNumber ? "Room " + sess.roomNumber : "Physical");
          const label = [num, time, type].filter(Boolean).join(" · ");
          const opt = el("option", "", label);
          opt.value = sess.sessionId;
          sessionSelect.append(opt);
        });
      }
    }

    let activeSessionId = preselectedSessionId;
    if (!activeSessionId && dateSessions.length) {
      if (state.doctor.sessionId && dateSessions.some((s) => s.sessionId === state.doctor.sessionId)) {
        activeSessionId = state.doctor.sessionId;
      } else {
        activeSessionId = dateSessions[0].sessionId;
      }
    }

    if (sessionSelect && activeSessionId) {
      sessionSelect.value = activeSessionId;
    }

    await syncDoctorNotesPatients(activeSessionId, preselectedApptId);
  }

  async function syncDoctorNotesPatients(sessionId, preselectedApptId) {
    const pick = $("doctor-notes-pick");
    if (!pick) return;
    pick.replaceChildren();

    const title = document.querySelector("[data-notes-title]");
    const reason = document.querySelector("[data-notes-reason]");
    const status = document.querySelector("[data-notes-status]");

    if (!sessionId) {
      const opt = el("option", "", "No session selected");
      opt.value = "";
      pick.append(opt);
      if (title) title.textContent = "Consultation notes";
      if (reason) reason.textContent = "Select a date and session number to view patients.";
      return;
    }

    try {
      let appointments = [];
      try {
        const queue = await MC.doctorQueue(sessionId);
        if (queue && Array.isArray(queue.appointments)) {
          appointments = queue.appointments;
        }
      } catch (qErr) {
        appointments = (state.doctor.allAppointments || []).filter(
          (a) => a.sessionId === sessionId
        );
      }

      const allAppts = state.doctor.allAppointments || [];
      allAppts.forEach((a) => {
        if (a.sessionId === sessionId && !appointments.some((x) => x.appointmentId === a.appointmentId)) {
          appointments.push(a);
        }
      });

      appointments.sort((a, b) => (a.appointmentNumber || 0) - (b.appointmentNumber || 0));
      state.doctor.sessionAppointments = appointments;

      if (!appointments.length) {
        const opt = el("option", "", "No patients booked in this session");
        opt.value = "";
        pick.append(opt);
        if (title) title.textContent = "Consultation notes";
        if (reason) reason.textContent = "No patients have booked this session yet.";
        const dx = $("doctor-dx");
        const rx = $("doctor-rx");
        const fu = $("doctor-fu");
        if (dx) dx.value = "";
        if (rx) rx.value = "";
        if (fu) fu.value = "";
        const save = document.querySelector("[data-save-summary]");
        if (save) save.disabled = true;
        setStatus(status, "No appointments available in the selected session.");
        return;
      }

      appointments.forEach((appt) => {
        const num = appt.appointmentNumber ? "#" + appt.appointmentNumber : "";
        const name = appt.patientName || "Patient";
        const statusLabel = APPT_STATUS[appt.status]
          ? APPT_STATUS[appt.status][0]
          : titleCase(appt.status);
        const label = [num, name, "(" + statusLabel + ")"].filter(Boolean).join(" · ");
        const opt = el("option", "", label);
        opt.value = appt.appointmentId;
        pick.append(opt);
      });

      let targetAppt = null;
      if (preselectedApptId) {
        targetAppt = appointments.find((a) => a.appointmentId === preselectedApptId);
      }
      if (!targetAppt) {
        targetAppt = appointments.find((a) => a.status === "IN_CONSULTATION") ||
                     appointments.find((a) => a.status === "COMPLETED") ||
                     appointments[0];
      }

      if (targetAppt) {
        pick.value = targetAppt.appointmentId;
        await selectNotes(targetAppt);
      }
    } catch (err) {
      console.warn("Could not load session patients:", err);
    }
  }

  async function selectNotes(appointment) {
    if (!appointment) return;

    state.doctor.selected = appointment;
    state.doctor.summary = null;

    const title = document.querySelector("[data-notes-title]");
    const reason = document.querySelector("[data-notes-reason]");
    const status = document.querySelector("[data-notes-status]");
    const dx = $("doctor-dx");
    const rx = $("doctor-rx");
    const fu = $("doctor-fu");
    const save = document.querySelector("[data-save-summary]");
    const chatLink = document.querySelector("[data-doctor-chat-link]");
    const chatBtn = document.querySelector("[data-doctor-to-chat]");
    const pick = $("doctor-notes-pick");

    const name = appointment.patientName || "Patient";
    const number = appointment.appointmentNumber
      ? "#" + appointment.appointmentNumber + " · "
      : "";

    if (title) title.textContent = number + name;
    if (reason) {
      reason.textContent =
        "Status: " +
        (APPT_STATUS[appointment.status]
          ? APPT_STATUS[appointment.status][0]
          : titleCase(appointment.status)) +
        " · Payment: " +
        (appointment.paymentStatus === "PAID" ? "Paid" : "Not paid") +
        (appointment.bookingReference
          ? " · Ref " + referenceOf(appointment.bookingReference)
          : "");
    }

    if (pick && pick.value !== appointment.appointmentId) {
      pick.value = appointment.appointmentId;
    }

    if (dx) dx.value = "";
    if (rx) rx.value = "";
    if (fu) fu.value = "";

    const inConsult = appointment.status === "IN_CONSULTATION";
    const completed = appointment.status === "COMPLETED";

    if (save) {
      save.disabled = false;
      save.textContent = inConsult
        ? "Complete consultation & save notes"
        : completed
        ? "Update notes"
        : "Save notes";
    }

    const isOnline = appointment.consultationType === "ONLINE";
    if (chatLink) {
      chatLink.hidden = !isOnline;
      chatLink.onclick = async (e) => {
        e.preventDefault();
        await ensureDoctorConsultationStarted(appointment);
        state.consult.requestedId = appointment.appointmentId;
        nav("consult");
      };
    }
    if (chatBtn) {
      chatBtn.hidden = !isOnline;
      chatBtn.onclick = async () => {
        await ensureDoctorConsultationStarted(appointment);
        state.consult.requestedId = appointment.appointmentId;
        nav("consult");
      };
    }

    setStatus(
      status,
      completed
        ? "Add or update diagnosis and prescription, then save."
        : inConsult
        ? "Consultation in progress. Saving will complete the consultation and publish notes to the patient."
        : "Consultation must be started or completed before saving notes."
    );

    try {
      const summary = await MC.summary(appointment.appointmentId);
      if (!summary) return;

      state.doctor.summary = summary;

      if (dx) dx.value = summary.diagnosis || "";
      if (rx) rx.value = summary.prescription || summary.treatmentNotes || "";
      if (fu) fu.value = summary.followUpInstructions || "";

      if (save) save.textContent = "Update notes";
      setStatus(status, "Summary loaded. Saving updates the existing record.");
    } catch (error) {
      if (error.status !== 404) setStatus(status, error.message, true);
    }
  }

  async function saveDoctorSummary() {
    let appointment = state.doctor.selected;
    const pick = $("doctor-notes-pick");
    if ((!appointment || appointment.appointmentId !== (pick && pick.value)) && pick && pick.value) {
      appointment = (state.doctor.sessionAppointments || []).find(
        (a) => a.appointmentId === pick.value
      ) || (state.doctor.allAppointments || []).find(
        (a) => a.appointmentId === pick.value
      ) || (state.doctor.queue && state.doctor.queue.appointments || []).find(
        (a) => a.appointmentId === pick.value
      );
    }

    const status = document.querySelector("[data-notes-status]");
    const save = document.querySelector("[data-save-summary]");
    const dx = $("doctor-dx");
    const rx = $("doctor-rx");
    const fu = $("doctor-fu");

    if (!appointment) {
      setStatus(status, "Please select a patient / consultation first.", true);
      return;
    }

    const diagnosis = dx ? dx.value.trim() : "";
    if (!diagnosis) {
      setStatus(status, "Diagnosis summary is required before saving.", true);
      if (dx) dx.focus();
      return;
    }

    if (save) save.disabled = true;

    try {
      if (appointment.status === "BOOKED" || appointment.status === "ARRIVED") {
        setStatus(status, "Starting consultation…");
        try {
          await MC.startConsultation(appointment.appointmentId);
          appointment.status = "IN_CONSULTATION";
        } catch (startErr) {
          // If start fails (e.g. not paid or already started), continue
        }
      }

      if (appointment.status === "IN_CONSULTATION") {
        setStatus(status, "Completing consultation…");
        try {
          if (typeof MC.completeConsultation === "function") {
            await MC.completeConsultation(appointment.appointmentId);
          } else {
            await MC.completeAndAdvance(appointment.appointmentId);
          }
          appointment.status = "COMPLETED";
        } catch (completeErr) {
          if (completeErr.status !== 409) {
            // ignore 409 if already completed
          }
          appointment.status = "COMPLETED";
        }
      }

      setStatus(status, "Saving clinical notes…");
      const summary = await MC.saveSummary(
        appointment.appointmentId,
        {
          diagnosis,
          symptoms: null,
          treatmentNotes: null,
          prescription: rx ? rx.value.trim() : null,
          followUpInstructions: fu ? fu.value.trim() : null,
          followUpDate: null,
        },
        Boolean(state.doctor.summary)
      );

      state.doctor.summary = summary;
      setStatus(
        status,
        "Notes and prescription saved successfully! The patient can now view them."
      );
      if (save) {
        save.textContent = "Update notes";
      }

      const reason = document.querySelector("[data-notes-reason]");
      if (reason) {
        reason.textContent =
          "Status: Completed · Payment: " +
          (appointment.paymentStatus === "PAID" ? "Paid" : "Not paid") +
          (appointment.bookingReference
            ? " · Ref " + referenceOf(appointment.bookingReference)
            : "");
      }

      await loadDoctorNotesPicker(appointment.appointmentId);
    } catch (error) {
      setStatus(status, error.message || "Could not save notes.", true);
    } finally {
      if (save) save.disabled = false;
    }
  }

  // ---------------------------------------------------------------
  // Consultation room (patient and doctor)
  // ---------------------------------------------------------------

  async function loadConsultationPicker() {
    if (!S) return;

    const select = $("consult-pick");
    const empty = document.querySelector("[data-consult-empty]");
    const layout = document.querySelector("[data-consult-layout]");

    try {
      const list =
        S.role === "DOCTOR"
          ? await MC.doctorAppointments({})
          : await MC.myAppointments();

      const appointments = (Array.isArray(list) ? list : []).filter(
        (item) =>
          item &&
          ["IN_CONSULTATION", "COMPLETED", "ARRIVED", "BOOKED"].includes(item.status)
      );

      state.consult.list = appointments;

      if (select) {
        select.replaceChildren();

        if (!appointments.length) {
          const option = el("option", "", "No consultations yet");
          option.value = "";
          select.append(option);
        }

        appointments.forEach((appointment) => {
          const who =
            S.role === "DOCTOR"
              ? appointment.patientName || "Patient"
              : doctorName(appointment);
          const option = el(
            "option",
            "",
            referenceOf(appointment.bookingReference) +
              " · " +
              who +
              " · " +
              formatDate(appointment.sessionDate) +
              " · " +
              (APPT_STATUS[appointment.status]
                ? APPT_STATUS[appointment.status][0]
                : titleCase(appointment.status))
          );
          option.value = appointment.appointmentId;
          select.append(option);
        });

        const requested =
          state.consult.requestedId ||
          state.consult.appointmentId ||
          (appointments[0] && appointments[0].appointmentId);

        state.consult.requestedId = null;

        if (requested && appointments.some((item) => item.appointmentId === requested)) {
          select.value = requested;
          await openConsultation(requested, appointments);
          return;
        }
      }

      if (!appointments.length) {
        if (empty) empty.hidden = false;
        if (layout) layout.hidden = true;
        state.consult.appointmentId = null;
        state.consult.appointment = null;
        return;
      }

      if (empty) empty.hidden = true;
      await openConsultation(select ? select.value : appointments[0].appointmentId, appointments);
    } catch (error) {
      if (error.status === 401) {
        handleSessionExpired();
        return;
      }
      setAppMessage(error.message);
      if (empty) {
        empty.hidden = false;
        empty.textContent = error.message;
      }
    }
  }

  async function openConsultation(appointmentId, knownList) {
    if (!appointmentId) return;

    const list = knownList || state.consult.list || [];
    let appointment = list.find(
      (item) => item.appointmentId === appointmentId
    );

    if (!appointment && S && S.role === "CUSTOMER") {
      appointment = state.appointments.find(
        (item) => item.appointmentId === appointmentId
      );
    }

    if (!appointment && S && S.role === "DOCTOR") {
      appointment =
        (state.doctor.allAppointments || []).find(
          (item) => item.appointmentId === appointmentId
        ) ||
        (state.doctor.queue && state.doctor.queue.appointments || []).find(
          (item) => item.appointmentId === appointmentId
        );
    }

    if (!appointment) {
      setAppMessage("That consultation could not be loaded.");
      return;
    }

    state.consult.appointmentId = appointmentId;
    state.consult.appointment = appointment;
    state.consult.summary = null;

    const select = $("consult-pick");
    if (select) select.value = appointmentId;

    const empty = document.querySelector("[data-consult-empty]");
    const layout = document.querySelector("[data-consult-layout]");
    if (empty) empty.hidden = true;
    if (layout) layout.hidden = false;

    renderConsultHeader(appointment);

    await Promise.allSettled([
      loadChatHistory(appointmentId),
      loadConsultSummary(appointmentId),
    ]);

    subscribeConsultation(appointment);
  }

  function renderConsultHeader(appointment) {
    const title = document.querySelector("[data-consult-title]");
    const meta = document.querySelector("[data-consult-meta]");
    const status = document.querySelector("[data-consult-status]");
    const note = document.querySelector("[data-chat-note]");
    const input = $("consult-c");
    const send = document.querySelector("[data-chat-send]");

    if (title) {
      title.textContent =
        appointment.consultationType === "ONLINE"
          ? "Online consultation"
          : "Consultation";
    }

    if (meta) {
      const who =
        S.role === "DOCTOR"
          ? appointment.patientName || "Patient"
          : doctorName(appointment);
      meta.textContent = [
        who,
        appointment.specialisation || "",
        "Ref " + referenceOf(appointment.bookingReference),
      ]
        .filter(Boolean)
        .join(" · ");
    }

    if (status) {
      const entry = APPT_STATUS[appointment.status] || ["Unknown", "slate"];
      status.className =
        "inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap " +
        (TONE[entry[1]] || TONE.slate);
      status.textContent = entry[0];
    }

    const active = appointment.status === "IN_CONSULTATION";
    const participant =
      S.role === "CUSTOMER" || S.role === "DOCTOR";

    if (input) {
      input.disabled = !active || !participant;
      input.placeholder = active
        ? "Type a message…"
        : appointment.status === "COMPLETED"
          ? "This consultation has ended (read-only)"
          : "Waiting for your doctor to open the chat…";
    }

    if (send) send.disabled = !active || !participant;

    if (note) {
      if (active) {
        note.textContent =
          "Messages are stored securely. The doctor can complete the consultation at any time.";
      } else if (appointment.status === "COMPLETED") {
        note.textContent =
          "This consultation has ended, so the chat is read-only. Your summary remains available.";
      } else {
        note.textContent =
          "Your consultation room is private to you and your doctor. It unlocks automatically here as soon as your doctor opens the chat.";
      }
    }

    const completeBtn = document.querySelector("[data-doctor-complete-consult]");
    if (completeBtn) {
      completeBtn.hidden = !(S && S.role === "DOCTOR" && appointment.status === "IN_CONSULTATION");
      completeBtn.onclick = async () => {
        try {
          completeBtn.disabled = true;
          if (typeof MC.completeConsultation === "function") {
            await MC.completeConsultation(appointment.appointmentId);
          } else {
            await MC.completeAndAdvance(appointment.appointmentId);
          }
          appointment.status = "COMPLETED";
          state.doctor.selected = appointment;
          nav("doctor");
          setTimeout(() => {
            activatePanel(
              document.querySelector('[data-view="doctor"]'),
              document.querySelector('[href="#doctor-n"]')
            );
            void selectNotes(appointment);
          }, 100);
        } catch (err) {
          alert(err.message || "Could not complete consultation");
          completeBtn.disabled = false;
        }
      };
    }

    const editNotesBtn = document.querySelector("[data-doctor-edit-notes]");
    if (editNotesBtn) {
      editNotesBtn.hidden = !(S && S.role === "DOCTOR");
      editNotesBtn.onclick = (e) => {
        e.preventDefault();
        state.doctor.selected = appointment;
        nav("doctor");
        setTimeout(() => {
          activatePanel(
            document.querySelector('[data-view="doctor"]'),
            document.querySelector('[href="#doctor-n"]')
          );
          void selectNotes(appointment);
        }, 100);
      };
    }
  }

  async function loadChatHistory(appointmentId) {
    const log = document.querySelector("[data-chat-log]");
    if (!log) return;

    log.style.opacity = "0.7";

    try {
      const messages = await MC.chatHistory(appointmentId);
      log.replaceChildren();

      if (!Array.isArray(messages) || !messages.length) {
        log.append(
          el(
            "p",
            "text-sm text-mute",
            "No messages yet. Say hello to your doctor."
          )
        );
        return;
      }

      messages.forEach((message) => appendChatMessage(message));
      log.scrollTop = log.scrollHeight;
    } catch (error) {
      log.replaceChildren();
      log.append(el("p", "text-sm text-bad", error.message));
    } finally {
      log.style.opacity = "1";
    }
  }

  function appendChatMessage(message) {
    const log = document.querySelector("[data-chat-log]");
    if (!log) return;

    const own = S && message.senderUserId === S.id;
    const wrapper = el(
      "div",
      "max-w-[80%] px-3 py-2 border rounded-xl " +
        (own
          ? "self-end bg-sky-50 border-sky-200"
          : "bg-white border-line")
    );

    const meta = el(
      "p",
      "mb-1 text-[10px] font-semibold uppercase tracking-wide text-mute",
      (message.senderName || titleCase(message.senderRole)) +
        " · " +
        formatDateTime(message.sentAt)
    );

    const body = el("p", "whitespace-pre-wrap break-words", message.content);

    wrapper.append(meta, body);
    log.append(wrapper);
  }

  function subscribeConsultation(appointment) {
    const id = appointment.appointmentId;

    if (state.consult.chatSub) unsubscribe("chat");
    if (state.consult.typingSub) unsubscribe("typing");
    if (state.consult.statusSub) unsubscribe("status");

    state.consult.chatSub = subscribe(
      "chat",
      "/topic/appointments/" + id + "/chat",
      (message) => {
        const log = document.querySelector("[data-chat-log]");
        if (!log) return;

        const placeholder = log.querySelector("p.text-mute");
        if (placeholder) placeholder.remove();

        const nearBottom =
          log.scrollHeight - log.scrollTop - log.clientHeight < 80;

        appendChatMessage(message);

        if (nearBottom) log.scrollTop = log.scrollHeight;
      }
    );

    state.consult.typingSub = subscribe(
      "typing",
      "/topic/appointments/" + id + "/typing",
      (payload) => {
        if (!payload || S.role === payload.senderRole) return;

        const node = document.querySelector("[data-typing]");
        if (!node) return;

        node.textContent = payload.typing
          ? (payload.senderName || "The other participant") + " is typing…"
          : "";

        if (state.consult.remoteTypingTimer) {
          clearTimeout(state.consult.remoteTypingTimer);
        }

        if (payload.typing) {
          state.consult.remoteTypingTimer = setTimeout(() => {
            node.textContent = "";
          }, 4000);
        }
      }
    );

    subscribe("chat-errors", "/user/queue/errors", (payload) => {
      if (payload && payload.message) setAppMessage(payload.message);
    });

    state.consult.statusSub = subscribe(
      "status",
      "/topic/appointments/" + id + "/status",
      async (payload) => {
        if (!payload || !state.consult.appointment) return;

        state.consult.appointment.status = payload.status;
        renderConsultHeader(state.consult.appointment);

        if (payload.status === "COMPLETED") {
          await loadConsultSummary(id);
          if (state.consult.typingTimer) clearTimeout(state.consult.typingTimer);
          const node = document.querySelector("[data-typing]");
          if (node) node.textContent = "";
        }
      }
    );
  }

  function sendChatMessage() {
    const input = $("consult-c");
    const appointment = state.consult.appointment;

    if (!input || !appointment) return;

    const content = input.value.trim();

    if (!content) return;

    if (content.length > MAX_CHAT_LENGTH) {
      setAppMessage("Messages must be 1000 characters or fewer.");
      return;
    }

    if (appointment.status !== "IN_CONSULTATION") {
      setAppMessage("This consultation is read-only.");
      return;
    }

    try {
      publish("/app/appointments/" + appointment.appointmentId + "/chat", {
        content,
      });

      input.value = "";
      sendTyping(false);
    } catch (error) {
      setAppMessage(error.message);
    }
  }

  function sendTyping(typing) {
    const appointment = state.consult.appointment;
    if (!appointment || appointment.status !== "IN_CONSULTATION") return;
    if (!S || !["CUSTOMER", "DOCTOR"].includes(S.role)) return;

    try {
      publish(
        "/app/appointments/" + appointment.appointmentId + "/typing",
        { typing: Boolean(typing) }
      );
    } catch {
      // Typing is best-effort.
    }
  }

  function handleTypingInput() {
    const appointment = state.consult.appointment;
    if (!appointment || appointment.status !== "IN_CONSULTATION") return;

    if (state.consult.typingStopTimer) {
      clearTimeout(state.consult.typingStopTimer);
    }

    if (Date.now() - state.consult.typingSentAt > 2000) {
      state.consult.typingSentAt = Date.now();
      sendTyping(true);
    }

    state.consult.typingStopTimer = setTimeout(() => {
      state.consult.typingSentAt = 0;
      sendTyping(false);
    }, 4000);
  }

  async function loadConsultSummary(appointmentId) {
    const empty = document.querySelector("[data-summary-empty]");
    const summary = document.querySelector("[data-summary]");
    const diagnosis = document.querySelector("[data-summary-diagnosis]");
    const prescription = document.querySelector("[data-summary-prescription]");
    const followup = document.querySelector("[data-summary-followup]");
    const date = document.querySelector("[data-summary-date]");
    const feedback = document.querySelector("[data-feedback-form]");
    const line = document.querySelector("[data-consult-summary-line]");

    const appointment = state.consult.appointment;

    if (feedback) {
      feedback.hidden = !(S && S.role === "CUSTOMER" && appointment &&
        appointment.status === "COMPLETED");
    }

    if (line) {
      line.textContent =
        appointment && appointment.status === "COMPLETED"
          ? "Consultation completed. You can read the summary and leave feedback."
          : "Visible to you after the doctor completes the consultation.";
    }

    try {
      const record = await MC.summary(appointmentId);
      if (!record) {
        state.consult.summary = null;
        if (summary) summary.hidden = true;
        if (empty) empty.hidden = false;
        updateDoctorConsultSummaryBox(null);
        return;
      }

      state.consult.summary = record;

      if (empty) empty.hidden = true;
      if (summary) summary.hidden = false;
      if (line) {
        line.textContent = "Consultation completed. Clinical summary and prescription are published above.";
      }
      if (diagnosis) diagnosis.textContent = record.diagnosis || "—";
      if (prescription) {
        prescription.textContent =
          record.prescription || record.treatmentNotes || "—";
      }
      if (followup) {
        followup.textContent =
          record.followUpInstructions ||
          (record.followUpDate
            ? "Follow up on " + formatDate(record.followUpDate)
            : "—");
      }
      if (date) {
        date.textContent =
          "Published " +
          formatDateTime(record.updatedAt || record.createdAt) +
          (record.doctorName ? " by " + doctorName({ doctorName: record.doctorName }) : "");
      }
      updateDoctorConsultSummaryBox(record);
    } catch (error) {
      state.consult.summary = null;
      if (summary) summary.hidden = true;
      if (empty) {
        empty.hidden = false;
        empty.textContent = error.status === 404
          ? "The summary appears here after the doctor completes the consultation."
          : (error.message || "Something went wrong. Please try again.");
      }
      updateDoctorConsultSummaryBox(null);
    }
  }

  function updateDoctorConsultSummaryBox(record) {
    const docBox = document.querySelector("[data-doctor-consult-summary-box]");
    const docForm = document.querySelector("[data-consult-summary-form]");
    const toggleBtn = document.querySelector("[data-consult-summary-toggle]");
    const submitBtn = document.querySelector("[data-consult-summary-submit]");
    const dxInput = $("consult-dx");
    const rxInput = $("consult-rx");
    const fuInput = $("consult-fu");
    const statusMsg = document.querySelector("[data-consult-summary-status]");

    if (!docBox) return;

    const isDoctor = S && S.role === "DOCTOR";
    docBox.hidden = !isDoctor;
    if (statusMsg) statusMsg.textContent = "";

    if (isDoctor) {
      if (record) {
        if (dxInput) dxInput.value = record.diagnosis || "";
        if (rxInput) rxInput.value = record.prescription || record.treatmentNotes || "";
        if (fuInput) fuInput.value = record.followUpInstructions || "";
        if (toggleBtn) toggleBtn.textContent = "✏️ Edit summary";
        if (submitBtn) submitBtn.textContent = "Update & publish to patient";
        if (docForm) docForm.hidden = true;
      } else {
        if (dxInput) dxInput.value = "";
        if (rxInput) rxInput.value = "";
        if (fuInput) fuInput.value = "";
        if (toggleBtn) toggleBtn.textContent = "✍️ Write summary";
        if (submitBtn) submitBtn.textContent = "Save & publish to patient";
        if (docForm) docForm.hidden = false;
      }
    }
  }

  async function submitConsultSummary(event) {
    if (event) event.preventDefault();
    const appointment = state.consult.appointment;
    const dxInput = $("consult-dx");
    const rxInput = $("consult-rx");
    const fuInput = $("consult-fu");
    const statusMsg = document.querySelector("[data-consult-summary-status]");
    const submitBtn = document.querySelector("[data-consult-summary-submit]");

    if (!appointment) return;

    const diagnosis = dxInput ? dxInput.value.trim() : "";
    if (!diagnosis) {
      setStatus(statusMsg, "Diagnosis summary is required before saving.", true);
      if (dxInput) dxInput.focus();
      return;
    }

    const prescription = rxInput ? rxInput.value.trim() : null;
    const followUpInstructions = fuInput ? fuInput.value.trim() : null;

    if (submitBtn) submitBtn.disabled = true;

    try {
      if (appointment.status === "IN_CONSULTATION") {
        setStatus(statusMsg, "Completing consultation…");
        try {
          if (typeof MC.completeConsultation === "function") {
            await MC.completeConsultation(appointment.appointmentId);
          } else {
            await MC.completeAndAdvance(appointment.appointmentId);
          }
          appointment.status = "COMPLETED";
          renderConsultHeader(appointment);
        } catch (completeErr) {
          if (completeErr.status !== 409) {
            throw completeErr;
          }
          appointment.status = "COMPLETED";
        }
      }

      setStatus(statusMsg, "Publishing summary to patient…");
      const summary = await MC.saveSummary(
        appointment.appointmentId,
        {
          diagnosis,
          symptoms: null,
          treatmentNotes: null,
          prescription,
          followUpInstructions,
          followUpDate: null,
        },
        Boolean(state.consult.summary)
      );

      state.consult.summary = summary;
      setStatus(
        statusMsg,
        "Summary published successfully! The patient can now view it."
      );

      await loadConsultSummary(appointment.appointmentId);
      if (submitBtn) submitBtn.textContent = "Update & publish to patient";

      if (state.doctor.sessionId) {
        void loadDoctorQueue(state.doctor.sessionId, { silent: true });
      }
    } catch (error) {
      setStatus(statusMsg, error.message || "Could not publish summary.", true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function submitFeedback() {
    const appointment = state.consult.appointment;
    const rating = $("consult-rt");
    const comment = $("consult-fc");
    const status = document.querySelector("[data-feedback-status]");
    const form = document.querySelector("[data-feedback-form]");

    if (!appointment) return;

    if (form) {
      const button = form.querySelector("button[type=submit]");
      if (button) button.disabled = true;
    }

    try {
      await MC.submitReview(
        appointment.appointmentId,
        Number(rating ? rating.value : 5),
        comment ? comment.value.trim() : ""
      );
      setStatus(status, "Thank you — your feedback has been recorded.");
    } catch (error) {
      setStatus(status, error.message, true);
    } finally {
      if (form) {
        const button = form.querySelector("button[type=submit]");
        if (button) button.disabled = false;
      }
    }
  }

  async function loadAdminSpecialisations() {
    const selects = Array.from(
      document.querySelectorAll("[data-specialisation-select]")
    ).filter((select) => select.dataset.loaded !== "true");
    if (!selects.length) return;

    try {
      const items = await MC.specialisations();
      if (!Array.isArray(items)) return;

      selects.forEach((select) => {
        select.replaceChildren();

        const placeholder = el("option", "", "Select specialisation…");
        placeholder.value = "";
        placeholder.selected = true;
        placeholder.disabled = true;
        select.append(placeholder);

        items.forEach((specialisation) => {
          const option = el(
            "option",
            "",
            specialisation.name || specialisation.displayName || specialisation.title || "Specialisation"
          );
          option.value = specialisation.specialisationId || specialisation.id;
          select.append(option);
        });

        select.dataset.loaded = "true";
      });
    } catch (error) {
      // Fall back silently; creation will surface the real error.
      selects.forEach((select) => {
        select.dataset.loaded = "true";
      });
      console.error(error);
    }
  }

  async function loadAdminStats() {
    const doctorsEl = document.querySelector('[data-admin-stat="doctors"]');
    const activeEl = document.querySelector('[data-admin-stat="active"]');
    const managersEl = document.querySelector('[data-admin-stat="managers"]');
    const appointmentsEl = document.querySelector('[data-admin-stat="appointments"]');
    if (!doctorsEl && !activeEl) return;

    try {
      const [statsResp, usersResp] = await Promise.allSettled([
        typeof MC.adminStats === "function" ? MC.adminStats() : (MC.request ? MC.request("admin/stats") : Promise.resolve(null)),
        typeof MC.adminUsers === "function" ? MC.adminUsers() : (MC.request ? MC.request("admin/users") : Promise.resolve([]))
      ]);

      const stats = statsResp.status === "fulfilled" ? statsResp.value : null;
      const users = (usersResp.status === "fulfilled" && Array.isArray(usersResp.value)) ? usersResp.value : [];

      if (stats) {
        if (doctorsEl && stats.totalDoctors != null) doctorsEl.textContent = stats.totalDoctors;
        if (activeEl && stats.totalUsers != null) activeEl.textContent = stats.totalUsers;
        if (appointmentsEl && stats.totalAppointments != null) appointmentsEl.textContent = stats.totalAppointments;
      } else if (users.length) {
        const docCount = users.filter((u) => u.role === "DOCTOR").length;
        if (doctorsEl) doctorsEl.textContent = docCount;
        if (activeEl) activeEl.textContent = users.length;
      }

      if (managersEl) {
        const mgrCount = users.filter((u) => u.role === "MANAGER").length;
        managersEl.textContent = mgrCount || 3;
      }
    } catch (err) {
      console.warn("Could not load admin stats:", err);
    }
  }

  const staffDirectory = new Map();
  let staffDoctorProfiles = new Map();

  async function loadStaffAccounts() {
    const adminTbody = document.querySelector("[data-staff-tbody]");
    const managerTbody = document.querySelector("[data-manager-staff-tbody]");
    if (!adminTbody && !managerTbody) return;

    try {
      const [usersResp, doctorsResp] = await Promise.allSettled([
        typeof MC.adminUsers === "function" ? MC.adminUsers() : (MC.request ? MC.request("admin/users") : Promise.resolve([])),
        typeof MC.doctors === "function" ? MC.doctors() : (MC.request ? MC.request("doctors") : Promise.resolve([]))
      ]);

      const users = (usersResp.status === "fulfilled" && Array.isArray(usersResp.value))
        ? usersResp.value
        : [];
      const doctors = (doctorsResp.status === "fulfilled" && Array.isArray(doctorsResp.value))
        ? doctorsResp.value
        : [];

      staffDirectory.clear();
      staffDoctorProfiles = new Map(
        doctors.map((doctor) => [doctor.doctorId, doctor])
      );

      const staffList = users.filter((u) => ["DOCTOR", "MANAGER", "ADMIN"].includes(u.role));

      function displayNameFor(member) {
        if (member.role === "DOCTOR") {
          const profile = member.doctorId
            ? staffDoctorProfiles.get(member.doctorId)
            : null;
          if (profile) return "Dr. " + profile.firstName + " " + profile.lastName;
          return "Dr. " + titleCase(
            member.email.split("@")[0].replace(/[._0-9]/g, " ").trim()
          );
        }
        if (member.role === "MANAGER") {
          return titleCase(
            member.email.split("@")[0].replace(/[._0-9]/g, " ").trim()
          ) + " (Manager)";
        }
        if (member.role === "ADMIN") {
          return titleCase(
            member.email.split("@")[0].replace(/[._0-9]/g, " ").trim()
          ) + " (Admin)";
        }
        return member.email;
      }

      function renderStaffRows(tbody, isActionable) {
        if (!tbody) return;
        tbody.replaceChildren();

        if (!staffList.length) {
          const tr = el("tr");
          tr.innerHTML = `<td colspan="${isActionable ? 5 : 4}" class="text-center py-4 text-mute">No staff accounts found.</td>`;
          tbody.append(tr);
          return;
        }

        staffList.forEach((member) => {
          staffDirectory.set(member.userId, member);
          const tr = el("tr");
          const displayName = displayNameFor(member);

          const roleBadge = member.role === "DOCTOR"
            ? '<span class="inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-teal-50 text-teal-900 border-teal-200">Doctor</span>'
            : member.role === "MANAGER"
            ? '<span class="inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-yellow-100 text-yellow-900 border-yellow-200">Manager</span>'
            : '<span class="inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-red-100 text-red-900 border-red-200">Admin</span>';

          const isActive = member.accountStatus === "ACTIVE";
          const isDeleted = member.accountStatus === "DELETED";
          const isSelf = Boolean(S && S.email && S.email === member.email);
          const statusBadge = isActive
            ? '<span class="inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-green-50 text-green-800 border-green-200">Active</span>'
            : '<span class="inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-orange-50 text-orange-800 border-orange-200">' + escapeHtml(member.accountStatus) + '</span>';

          let actionHtml = "";
          if (isActionable) {
            const editBtn = isDeleted
              ? ""
              : `<button type="button" data-edit-user="${member.userId}" class="inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow hover:text-ink min-h-8 px-2.5 py-1 text-xs">Edit</button>`;
            const toggleBtn = (isDeleted || isSelf)
              ? ""
              : isActive
                ? `<button type="button" data-toggle-user="${member.userId}" data-action="suspend" class="inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow hover:text-ink min-h-8 px-2.5 py-1 text-xs">Deactivate</button>`
                : `<button type="button" data-toggle-user="${member.userId}" data-action="activate" class="inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-brand border-brand text-white hover:bg-brand-d min-h-8 px-2.5 py-1 text-xs">Activate</button>`;
            const deleteBtn = (isDeleted || isSelf)
              ? ""
              : `<button type="button" data-delete-user="${member.userId}" class="inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 min-h-8 px-2.5 py-1 text-xs">Delete</button>`;
            actionHtml = `<td data-label="Actions"><div class="flex flex-wrap gap-1.5">${editBtn}${toggleBtn}${deleteBtn}</div></td>`;
          }

          tr.innerHTML = `
            <td data-label="Name" class="font-semibold text-ink">${escapeHtml(displayName)}</td>
            <td data-label="Email" class="text-slate2">${escapeHtml(member.email)}</td>
            <td data-label="Role">${roleBadge}</td>
            <td data-label="Status">${statusBadge}</td>
            ${actionHtml}
          `;
          tbody.append(tr);
        });
      }

      renderStaffRows(adminTbody, true);
      renderStaffRows(managerTbody, false);
    } catch (err) {
      console.warn("Could not load staff accounts:", err);
    }
  }

  function openEditAccount(userId) {
    const member = staffDirectory.get(userId);
    const dialog = $("edit-account-dialog");
    const form = $("edit-account-form");
    if (!member || !dialog || !form) return;

    const isDoctor = member.role === "DOCTOR";
    form.dataset.userId = member.userId;
    form.dataset.role = member.role;
    form.dataset.doctorId = member.doctorId || "";

    const title = $("edit-account-title");
    const subtitle = form.querySelector("[data-edit-subtitle]");
    const doctorFields = form.querySelector("[data-edit-doctor-fields]");
    const userFields = form.querySelector("[data-edit-user-fields]");

    if (title) {
      title.textContent = isDoctor ? "Edit doctor profile" : "Edit account";
    }
    if (subtitle) {
      subtitle.textContent = member.email + " · " + (ROLE_LABELS[member.role] || member.role);
    }
    if (doctorFields) {
      doctorFields.hidden = !isDoctor;
      doctorFields.querySelectorAll("input, select").forEach((input) => {
        input.required = isDoctor;
      });
    }
    if (userFields) userFields.hidden = isDoctor;

    if (isDoctor) {
      const profile = staffDoctorProfiles.get(member.doctorId);
      const set = (name, value) => {
        const input = form.querySelector(`[data-edit-field="${name}"]`);
        if (input) input.value = value == null ? "" : value;
      };
      set("firstName", profile ? profile.firstName : "");
      set("lastName", profile ? profile.lastName : "");
      set("registrationNumber", profile ? profile.registrationNumber : "");
      set("qualification", profile ? profile.qualification : "");
      set("specialisationId", profile ? profile.specialisationId : "");
      set("consultationFee", profile ? profile.consultationFee : "");
    } else {
      const email = form.querySelector('[data-edit-field="email"]');
      if (email) email.value = member.email || "";
    }

    setStatus(form.querySelector("[data-edit-status]"), "");
    void loadAdminSpecialisations();
    dialog.showModal();
  }

  function openDeleteAccount(userId) {
    const member = staffDirectory.get(userId);
    const dialog = $("delete-account-dialog");
    const form = $("delete-account-form");
    if (!member || !dialog || !form) return;

    form.dataset.userId = member.userId;
    const email = form.querySelector("[data-delete-email]");
    if (email) email.textContent = member.email;
    const confirmInput = form.querySelector("[data-delete-confirm]");
    if (confirmInput) confirmInput.value = "";
    const submit = form.querySelector("[data-delete-submit]");
    if (submit) submit.disabled = true;
    setStatus(form.querySelector("[data-delete-status]"), "");
    dialog.showModal();
    if (confirmInput) confirmInput.focus();
  }

  function renderAuditLogRow(log) {
    const tr = document.createElement("tr");

    let roleBadge = "";
    if (log.userRole === "ADMIN") {
      roleBadge = '<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 ml-1">ADMIN</span>';
    } else if (log.userRole === "MANAGER") {
      roleBadge = '<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 ml-1">MANAGER</span>';
    } else if (log.userRole === "DOCTOR") {
      roleBadge = '<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 ml-1">DOCTOR</span>';
    } else if (log.userRole === "CUSTOMER") {
      roleBadge = '<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800 ml-1">PATIENT</span>';
    }

    let actionClass = "font-medium text-slate2";
    const act = (log.action || "").toLowerCase();
    if (act.includes("created")) actionClass = "font-semibold text-emerald-700";
    if (act.includes("cancelled")) actionClass = "font-semibold text-rose-700";
    if (act.includes("delayed")) actionClass = "font-semibold text-amber-700";
    if (act.includes("locked")) actionClass = "font-semibold text-rose-800";

    let timeStr = "—";
    if (log.createdAt) {
      const d = new Date(log.createdAt);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const day = String(d.getDate()).padStart(2, "0");
      const month = months[d.getMonth()];
      const hours = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");
      timeStr = `${day} ${month} ${hours}:${mins}`;
    }

    tr.innerHTML = `
      <td data-label="Time" class="whitespace-nowrap text-xs text-mute font-mono">${timeStr}</td>
      <td data-label="User" class="text-sm font-medium text-ink">${escapeHtml(log.userEmail || "System")}${roleBadge}</td>
      <td data-label="Action" class="text-sm ${actionClass}">${escapeHtml(log.action || "")}</td>
      <td data-label="Details" class="text-xs text-slate2 max-w-xs truncate" title="${escapeHtml(log.details || "")}">${escapeHtml(log.details || "—")}</td>
      <td data-label="IP" class="whitespace-nowrap text-xs text-mute font-mono">${escapeHtml(log.ipAddress || "127.0.0.1")}</td>
    `;
    return tr;
  }

  function subscribeAdminAuditLogs() {
    if (!S || (S.role !== "ADMIN" && S.role !== "MANAGER")) return;
    subscribe("admin-audit-logs", "/topic/audit-logs", (log) => {
      const tbody = document.querySelector("[data-admin-audit-tbody]");
      if (!tbody) return;
      const emptyRow = tbody.querySelector("td[colspan]");
      if (emptyRow) emptyRow.closest("tr").remove();

      const tr = renderAuditLogRow(log);
      tr.style.backgroundColor = "rgba(254, 243, 199, 0.75)";
      tr.style.transition = "background-color 2.5s ease";
      tbody.prepend(tr);
      setTimeout(() => {
        tr.style.backgroundColor = "transparent";
      }, 3000);
    });
  }

  async function loadAuditLogs() {
    const tbody = document.querySelector("[data-admin-audit-tbody]");
    if (!tbody) return;

    try {
      const logs = await MC.auditLogs();
      if (!Array.isArray(logs) || !logs.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-mute">No audit log entries recorded yet.</td></tr>';
        return;
      }

      tbody.replaceChildren();
      logs.forEach((log) => tbody.append(renderAuditLogRow(log)));
    } catch (err) {
      console.warn("Could not load audit logs:", err);
      // Escape the message: even though the API client sanitises server
      // text, the error row must never interpret a value as markup.
      const message = escapeHtml(err.message || "Unknown error");
      tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-rose-600">Failed to load audit logs: ${message}</td></tr>`;
    }
  }

  const ROLE_LABELS = {
    DOCTOR: "doctor",
    MANAGER: "manager",
    CUSTOMER: "patient",
    ADMIN: "administrator",
  };

  function readFormField(form, name) {
    const node = form.querySelector(`[data-field="${name}"]`);
    return node ? String(node.value || "").trim() : "";
  }

  function syncCreateFormRole(form) {
    const roleSelect = form.querySelector("[data-role-select]");
    if (!roleSelect) return;

    const isDoctor = roleSelect.value === "DOCTOR";
    form.querySelectorAll("[data-doctor-field]").forEach((field) => {
      field.hidden = !isDoctor;
      field.querySelectorAll("input, select").forEach((input) => {
        input.required = isDoctor;
      });
    });

    const note = form.querySelector("[data-role-note]");
    if (note) {
      note.textContent = isDoctor
        ? "The password is temporary. The doctor must change it at first login."
        : "The account is activated immediately. Share the temporary password securely; the user can change it after signing in.";
    }
  }

  async function handleCreateAccount(form) {
    const status = form.querySelector("[data-create-status]") ||
      form.querySelector("[data-admin-create-status]");
    const button = form.querySelector("button[type=submit]");

    const role = readFormField(form, "role").toUpperCase();
    const email = readFormField(form, "email");
    const firstName = readFormField(form, "firstName");
    const lastName = readFormField(form, "lastName");
    const password = readFormField(form, "password");
    const confirmPassword = readFormField(form, "confirmPassword");
    const registrationNumber = readFormField(form, "registrationNumber");
    const qualification = readFormField(form, "qualification");
    const specialisationId = readFormField(form, "specialisationId");
    const consultationFee = Number(readFormField(form, "consultationFee") || 0);

    if (!email || !password || !confirmPassword || !firstName || !lastName) {
      setStatus(status, "Please fill in every required field.", true);
      return;
    }

    if (role === "DOCTOR" &&
        (!registrationNumber || !specialisationId || !(consultationFee >= 0))) {
      setStatus(status, "Please fill in every required doctor field.", true);
      return;
    }

    if (password !== confirmPassword) {
      setStatus(status, "The passwords do not match.", true);
      return;
    }

    if (button) button.disabled = true;
    setStatus(status, "Creating " + (ROLE_LABELS[role] || "account") + " account…");

    try {
      let result;

      if (role === "DOCTOR") {
        result = await MC.adminCreateDoctor({
          email,
          initialPassword: password,
          confirmPassword,
          firstName,
          lastName,
          registrationNumber,
          qualification,
          specialisationId,
          consultationFee,
        });

        if (result && result.userId && result.accountStatus === "PENDING" &&
            typeof MC.adminActivateUser === "function") {
          try {
            await MC.adminActivateUser(result.userId);
          } catch (_) {}
        }
      } else {
        result = await MC.adminCreateUser({
          role,
          email,
          password,
          confirmPassword,
          firstName,
          lastName,
        });
      }

      setStatus(
        status,
        (ROLE_LABELS[role] || "Account") +
          " account created for " +
          (result && (result.email || email)) +
          ". The account is active and ready for login."
      );
      form.reset();
      syncCreateFormRole(form);
      void loadStaffAccounts();
      void loadAdminStats();
      void loadAuditLogs();
    } catch (error) {
      setStatus(status, error.message || "Unable to create the account.", true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function loadAdminRooms() {
    const tbody = document.querySelector("[data-admin-rooms-tbody]");
    if (!tbody) return;

    try {
      const rooms = await MC.rooms();
      tbody.replaceChildren();

      if (!Array.isArray(rooms) || !rooms.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-mute">No consultation rooms found.</td></tr>';
        return;
      }

      rooms.forEach((r) => {
        const tr = el("tr");
        const typeBadge = (r.roomType === "PROCEDURE")
          ? '<span class="inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-amber-50 text-amber-800 border-amber-200">Procedure</span>'
          : (r.roomType === "OTHER")
          ? '<span class="inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-purple-50 text-purple-800 border-purple-200">Other</span>'
          : '<span class="inline-block px-2 py-0.5 border rounded-full text-[11px] leading-[14px] font-semibold tracking-wider uppercase whitespace-nowrap bg-sky-50 text-sky-800 border-sky-200">Consultation</span>';

        tr.innerHTML =
          '<td data-label="Room No."><b>' + escapeHtml(r.roomNumber) + '</b></td>' +
          '<td data-label="Name">' + escapeHtml(r.name || "—") + '</td>' +
          '<td data-label="Location">' + escapeHtml(r.location || "Hospital Main Building") + '</td>' +
          '<td data-label="Type">' + typeBadge + '</td>' +
          '<td data-label="Capacity">' + (r.capacity || 1) + '</td>';
        tbody.append(tr);
      });
    } catch (err) {
      console.warn("Could not load admin rooms:", err);
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-bad">Failed to load rooms.</td></tr>';
    }
  }

  async function handleAdminCreateRoom(form) {
    const status = form.querySelector("[data-admin-room-status]");
    const button = form.querySelector("button[type='submit']");
    const numInput = $("admin-room-number");
    const nameInput = $("admin-room-name");
    const locInput = $("admin-room-location");
    const typeSelect = $("admin-room-type");
    const capInput = $("admin-room-capacity");

    if (!numInput || !nameInput || !typeSelect) return;

    const payload = {
      roomNumber: numInput.value.trim(),
      name: nameInput.value.trim(),
      location: locInput ? locInput.value.trim() : "",
      roomType: typeSelect.value,
      capacity: Number(capInput ? capInput.value : 1) || 1,
    };

    if (!payload.roomNumber || !payload.name) {
      setStatus(status, "Room number and name are required.", true);
      return;
    }

    if (button) button.disabled = true;
    setStatus(status, "Creating consultation room…");

    try {
      const created = await MC.createRoom(payload);
      setStatus(
        status,
        "Consultation room " + (created.roomNumber || payload.roomNumber) + " created successfully!"
      );
      form.reset();
      void loadAdminRooms();
      void loadManagerSessionPicker();
    } catch (error) {
      setStatus(status, error.message || "Unable to create room.", true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function loadManagerSessionPicker() {
    const docSelect = $("sess-doc");
    const roomSelect = $("sess-room");
    const dateInput = $("sess-date");
    if (!docSelect || !roomSelect) return;

    if (dateInput) {
      const today = todayISO();
      dateInput.min = today;
      if (!dateInput.value) dateInput.value = today;
    }

    try {
      const [doctorsResp, roomsResp] = await Promise.allSettled([
        MC.doctors(),
        MC.rooms(),
      ]);

      if (doctorsResp.status === "fulfilled" && Array.isArray(doctorsResp.value)) {
        const curDoc = docSelect.value;
        docSelect.replaceChildren(el("option", "", "Choose a doctor…"));
        docSelect.firstChild.value = "";
        doctorsResp.value.forEach((d) => {
          const opt = el("option", "", "Dr. " + d.firstName + " " + d.lastName + " (" + (d.specialisation || "General") + ")");
          opt.value = d.doctorId || d.id;
          opt.dataset.fee = d.consultationFee || 2500;
          docSelect.append(opt);
        });
        if (curDoc) docSelect.value = curDoc;
      }

      if (roomsResp.status === "fulfilled" && Array.isArray(roomsResp.value)) {
        const curRoom = roomSelect.value;
        roomSelect.replaceChildren(el("option", "", "Choose consultation room…"));
        roomSelect.firstChild.value = "";
        roomsResp.value.forEach((r) => {
          const opt = el("option", "", r.roomNumber + " - " + (r.name || "Consultation Room"));
          opt.value = r.id;
          roomSelect.append(opt);
        });
        if (curRoom) roomSelect.value = curRoom;
      }
    } catch (err) {
      console.warn("Could not load manager session picker data:", err);
    }
  }

  async function loadManagerSessions() {
    const tbody = document.querySelector("[data-manager-sessions-tbody]");
    const dashTbody = document.querySelector("[data-manager-dashboard-sessions-tbody]");
    if (!tbody && !dashTbody) return;

    // The stat cards are authoritative backend aggregates, not public-feed
    // approximations. Load them independently of the session table.
    void loadManagerDashboard();

    try {
      const sessions = await MC.sessions({});
      if (!Array.isArray(sessions) || sessions.length === 0) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-mute">No hospital sessions scheduled yet.</td></tr>';
        if (dashTbody) dashTbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-mute">No sessions scheduled for today.</td></tr>';
        return;
      }

      // Fetch queue details in parallel
      const queuePromises = sessions.map((s) =>
        MC.sessionQueue(s.sessionId).catch(() => null)
      );
      const queueResults = await Promise.all(queuePromises);
      sessions.forEach((s, idx) => {
        s.queue = queueResults[idx];
      });

      // Calculate Manager Dashboard Stats
      const today = todayISO();
      const todaySessions = sessions.filter((s) => s.sessionDate === today);

      function renderRow(s) {
        const tr = document.createElement("tr");
        const statusClass = {
          OPEN: "bg-emerald-100 text-emerald-800",
          SCHEDULED: "bg-blue-100 text-blue-800",
          IN_PROGRESS: "bg-purple-100 text-purple-800",
          COMPLETED: "bg-slate-100 text-slate-800",
          CANCELLED: "bg-rose-100 text-rose-800",
        }[s.status] || "bg-gray-100 text-gray-800";

        const typeBadge = s.consultationType === "ONLINE"
          ? '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-100 text-sky-800">ONLINE</span>'
          : '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">PHYSICAL</span>';

        const canCancel = s.status === "OPEN" || s.status === "SCHEDULED";
        const sessionId = s.sessionId || s.id;

        let queueBadge = '<span class="text-xs text-mute font-medium">—</span>';
        if (s.queue && s.queue.nowServing != null) {
          queueBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 shadow-xs"><span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>Now serving #${escapeHtml(s.queue.nowServing)}</span>`;
        } else if (s.status === "IN_PROGRESS") {
          queueBadge = `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">In queue: #${escapeHtml(s.queue && s.queue.nextNumber ? s.queue.nextNumber : 1)}</span>`;
        } else if (s.status === "OPEN" || s.status === "SCHEDULED") {
          queueBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200">Starts at #${escapeHtml(s.queue && s.queue.nextNumber ? s.queue.nextNumber : 1)}</span>`;
        } else if (s.status === "COMPLETED") {
          queueBadge = `<span class="text-xs text-slate2 font-medium">Completed</span>`;
        } else if (s.status === "CANCELLED") {
          queueBadge = `<span class="text-xs text-rose-500 font-medium">Cancelled</span>`;
        }

        tr.innerHTML = `
          <td data-label="Doctor">
            <div class="font-semibold text-ink">${s.doctorName ? "Dr. " + escapeHtml(s.doctorName) : "Doctor"}</div>
            <div class="text-xs text-mute">${escapeHtml(s.specialisation || "General")}</div>
          </td>
          <td data-label="Date & Time">
            <div class="text-sm font-medium">${escapeHtml(s.sessionDate || "—")}</div>
            <div class="text-xs text-slate2">${escapeHtml((s.startTime || "").slice(0, 5))} - ${escapeHtml((s.endTime || "").slice(0, 5))}${s.delayMinutes ? ` <span class="text-peach font-bold">(+${escapeHtml(s.delayMinutes)}m delay)</span>` : ""}</div>
          </td>
          <td data-label="Type">${typeBadge}</td>
          <td data-label="Room">
            <span class="text-sm font-medium text-slate2">${escapeHtml(s.roomNumber || (s.consultationType === "ONLINE" ? "Online Room" : "—"))}</span>
          </td>
          <td data-label="Current Queue #">
            ${queueBadge}
          </td>
          <td data-label="Spots" class="text-right">
            <span class="font-bold text-brand">${s.remainingAppointments != null ? escapeHtml(s.remainingAppointments) : "—"}</span>
            <span class="text-xs text-mute">/ ${escapeHtml(s.maxAppointments || "—")}</span>
          </td>
          <td data-label="Status">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${statusClass}">${escapeHtml(s.status)}</span>
          </td>
          <td data-label="Actions">
            <div class="flex items-center gap-1.5 justify-end">
              ${canCancel ? `
                <button type="button" data-delay-session="${escapeHtml(sessionId)}" class="inline-flex items-center gap-1 border rounded-lg font-semibold cursor-pointer bg-white border-line text-amber-700 hover:bg-amber-50 px-2 py-1 text-xs" title="Delay session by 15 mins">⏱ +15m</button>
                <button type="button" data-cancel-session="${escapeHtml(sessionId)}" class="inline-flex items-center gap-1 border rounded-lg font-semibold cursor-pointer bg-white border-rose-200 text-rose-600 hover:bg-rose-50 px-2 py-1 text-xs" title="Cancel session">Cancel</button>
              ` : '<span class="text-xs text-mute">—</span>'}
            </div>
          </td>
        `;
        return tr;
      }

      if (tbody) {
        tbody.replaceChildren();
        sessions.forEach((s) => tbody.append(renderRow(s)));
      }

      if (dashTbody) {
        dashTbody.replaceChildren();
        const displayDash = todaySessions.length > 0 ? todaySessions : sessions.slice(0, 8);
        displayDash.forEach((s) => dashTbody.append(renderRow(s)));
      }
    } catch (err) {
      console.warn("Could not load manager sessions:", err);
      const message = escapeHtml(err.message || "Unknown error");
      if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-rose-600">Failed to load sessions: ${message}</td></tr>`;
      if (dashTbody) dashTbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-rose-600">Failed to load sessions: ${message}</td></tr>`;
    }
  }

  const DASHBOARD_REFRESH_MS = 15000;
  let dashboardRequest = null;
  let dashboardFetchedAt = 0;

  // Session changes make today's aggregates stale; the next dashboard load
  // must bypass the short refresh window.
  function invalidateManagerDashboard() {
    dashboardFetchedAt = 0;
  }

  function setManagerDashboardCards(values) {
    const targets = [
      ["[data-manager-sessions-today]", values.sessionsToday],
      ["[data-manager-doctors-today]", values.doctorsToday],
      ["[data-manager-completed-today]", values.completedToday],
      ["[data-manager-cancelled-today]", values.cancelledToday],
      ["[data-manager-appointments-today]", values.appointmentsToday],
      ["[data-manager-type-split]", values.typeSplit],
      ["[data-manager-revenue-today]", values.revenue],
    ];

    targets.forEach(([selector, value]) => {
      const node = document.querySelector(selector);
      if (node) node.textContent = value;
    });
  }

  // Loads GET /reports/overview scoped to today and fills the dashboard cards.
  // Every figure is computed by the backend; missing values render as "—".
  async function loadManagerDashboard(options) {
    const settings = options || {};
    const status = document.querySelector("[data-manager-dashboard-status]");
    const fresh = Date.now() - dashboardFetchedAt < DASHBOARD_REFRESH_MS;

    if (!settings.force && fresh) return true;
    if (dashboardRequest) return dashboardRequest;

    const firstLoad = dashboardFetchedAt === 0;
    if (firstLoad) {
      setManagerDashboardCards({
        sessionsToday: "…",
        doctorsToday: "…",
        completedToday: "…",
        cancelledToday: "…",
        appointmentsToday: "…",
        typeSplit: "…",
        revenue: "…",
      });
    }
    setStatus(status, firstLoad ? "Loading today’s figures…" : "");

    dashboardRequest = (async () => {
      try {
        const today = todayISO();
        const report = await MC.reportOverview({ from: today, to: today });
        const metrics = ManagerUI.dashboardMetrics(report);

        // Formatting (zero vs unavailable, LKR) lives in the tested helper.
        setManagerDashboardCards(ManagerUI.dashboardCardValues(metrics));

        dashboardFetchedAt = Date.now();
        setStatus(status, "");
        return true;
      } catch (error) {
        console.warn("Could not load manager dashboard report:", error);
        dashboardFetchedAt = 0;
        setManagerDashboardCards({
          sessionsToday: "—",
          doctorsToday: "—",
          completedToday: "—",
          cancelledToday: "—",
          appointmentsToday: "—",
          typeSplit: "—",
          revenue: "—",
        });
        setStatus(
          status,
          "Could not load today’s figures: " +
            (error.message || "Unknown error") +
            " The dashboard values are unavailable.",
          true
        );
        return false;
      } finally {
        dashboardRequest = null;
      }
    })();

    return dashboardRequest;
  }

  function managerReviewActionButton(review, action, label) {
    const button = el(
      "button",
      "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer disabled:bg-line disabled:border-line disabled:text-mute disabled:cursor-not-allowed bg-white border-line text-slate2 hover:bg-snow hover:text-ink min-h-9 sm:min-h-8 px-2.5 py-1 text-xs",
      label
    );
    button.type = "button";
    button.dataset.reviewAction = action;
    button.dataset.reviewId = String(review.reviewId);
    button.setAttribute(
      "aria-label",
      label + " review from " + (review.createdAt ? formatDateTime(review.createdAt) : "this patient")
    );
    return button;
  }

  function renderManagerReview(review) {
    const card = el(
      "article",
      "grid gap-3 rounded-lg border border-line bg-white p-3 sm:p-4"
    );
    card.dataset.managerReview = "";

    const status = typeof review.moderationStatus === "string"
      ? review.moderationStatus.trim().toUpperCase()
      : "";
    const heading = el("div", "flex flex-wrap items-center justify-between gap-2");
    const rating = Number(review.rating);
    heading.append(
      el(
        "strong",
        "text-sm font-semibold text-ink",
        Number.isInteger(rating) && rating >= 1 && rating <= 5
          ? "★ " + rating + " / 5"
          : "Rating unavailable"
      )
    );
    heading.append(
      badge(
        titleCase(status) || "Unknown status",
        status === "APPROVED" ? "green" : status === "HIDDEN" ? "slate" : "orange"
      )
    );
    card.append(heading);

    const comment = typeof review.comment === "string" && review.comment.trim()
      ? review.comment
      : "No written feedback was provided.";
    card.append(
      el("p", "text-sm text-slate2 whitespace-pre-wrap break-words", comment)
    );

    const footer = el("div", "flex flex-wrap items-center justify-between gap-3");
    const created = el(
      "time",
      "text-xs text-mute",
      review.createdAt ? formatDateTime(review.createdAt) : "Date unavailable"
    );
    if (typeof review.createdAt === "string") {
      created.dateTime = review.createdAt;
    }
    footer.append(created);

    const actions = el("div", "flex flex-wrap gap-2");
    if (typeof review.reviewId === "string" && review.reviewId) {
      if (status !== "APPROVED") {
        actions.append(managerReviewActionButton(review, "approve", "Approve"));
      }
      if (status !== "HIDDEN") {
        actions.append(managerReviewActionButton(review, "hide", "Hide"));
      }
    }
    footer.append(actions);
    card.append(footer);
    return card;
  }

  const adminNoticeState = {
    editingId: null,
    editingPublished: true,
    page: 1,
    pageSize: 6,
  };

  function setAdminNoticeFormMode(mode, notice) {
    const form = document.getElementById("admin-notice-form");
    if (!form) return;

    const title = form.querySelector("#admin-notice-title");
    const body = form.querySelector("#admin-notice-body");
    const submit = form.querySelector('[data-admin-notice-submit]');
    const cancel = form.querySelector('[data-admin-notice-cancel-edit]');
    const heading = document.querySelector("[data-admin-notice-form-heading]");
    const status = form.querySelector("[data-admin-notice-status]");

    if (mode === "edit" && notice) {
      adminNoticeState.editingId = notice.id || null;
      adminNoticeState.editingPublished = Boolean(notice.published);
      if (title) title.value = notice.title || "";
      if (body) body.value = notice.body || "";
      if (submit) submit.textContent = "Save changes";
      if (cancel) cancel.hidden = false;
      if (heading) heading.textContent = "Edit hospital notice";
      setStatus(status, "Editing notice. Saving will " + (adminNoticeState.editingPublished ? "keep it published." : "keep it as a draft/withdrawn notice."));
    } else {
      adminNoticeState.editingId = null;
      adminNoticeState.editingPublished = true;
      form.reset();
      if (submit) submit.textContent = "Publish notice";
      if (cancel) cancel.hidden = true;
      if (heading) heading.textContent = "Publish hospital notices";
      setStatus(status, "");
    }
  }

  function renderAdminNotice(notice) {
    const published = Boolean(notice.published);
    const card = el(
      "article",
      "grid gap-3 rounded-xl border border-line bg-white p-4 shadow-sm transition hover:shadow-md " +
        (published
          ? "border-l-4 border-l-emerald-400"
          : "border-l-4 border-l-slate-300")
    );
    card.dataset.adminNotice = notice.id || "";

    const header = el("div", "flex flex-wrap items-start justify-between gap-2");
    header.append(
      el(
        "h3",
        "min-w-0 break-words text-base font-semibold leading-snug text-ink",
        notice.title || "Untitled notice"
      )
    );
    header.append(badge(published ? "Published" : "Draft", published ? "green" : "slate"));
    card.append(header);

    card.append(
      el(
        "p",
        "whitespace-pre-wrap break-words text-sm leading-relaxed text-slate2",
        notice.body || ""
      )
    );

    const meta = el("div", "flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-mute");
    if (notice.publishedAt) {
      meta.append(el("span", "", "Published " + formatDateTime(notice.publishedAt)));
    } else if (notice.createdAt) {
      meta.append(el("span", "", "Created " + formatDateTime(notice.createdAt)));
    }
    if (notice.createdByName) {
      meta.append(
        el("span", "inline-flex items-center rounded-full bg-snow px-2 py-0.5 font-medium text-slate2", String(notice.createdByName))
      );
    }
    if (meta.childNodes.length) card.append(meta);

    const actions = el("div", "mt-1 flex flex-wrap items-center gap-2 border-t border-line pt-3");
    const editBtn = el("button", "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow min-h-9 px-3 py-1.5 text-xs", "Edit");
    editBtn.type = "button";
    editBtn.dataset.adminNoticeAction = "edit";
    editBtn.dataset.noticeId = notice.id || "";

    const toggleBtn = el(
      "button",
      "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow min-h-9 px-3 py-1.5 text-xs",
      notice.published ? "Withdraw" : "Publish"
    );
    toggleBtn.type = "button";
    toggleBtn.dataset.adminNoticeAction = notice.published ? "withdraw" : "publish";
    toggleBtn.dataset.noticeId = notice.id || "";

    const deleteBtn = el("button", "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-rose-200 text-rose-700 hover:bg-rose-50 min-h-9 px-3 py-1.5 text-xs", "Delete");
    deleteBtn.type = "button";
    deleteBtn.dataset.adminNoticeAction = "delete";
    deleteBtn.dataset.noticeId = notice.id || "";

    actions.append(editBtn, toggleBtn, deleteBtn);
    card.append(actions);
    return card;
  }

  function ensureAdminNoticesPanel() {
    const adminView = views.find((item) => item.dataset.view === "admin");
    if (!adminView) return false;

    const nav = adminView.querySelector("aside nav, aside");
    const main = adminView.querySelector("main");
    if (!nav || !main) return false;

    let link = adminView.querySelector('[data-panel-link][href="#admin-n"]');
    if (!link) {
      link = document.createElement("a");
      link.href = "#admin-n";
      link.className = "sa";
      link.dataset.panelLink = "";
      link.textContent = "Notices";
      const auditLink = adminView.querySelector('[data-panel-link][href="#admin-a"]');
      if (auditLink && auditLink.parentNode === nav) {
        nav.insertBefore(link, auditLink);
      } else {
        nav.append(link);
      }
    }

    let panel = adminView.querySelector("#admin-n");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "admin-n";
      panel.dataset.dashboardPanel = "";
      panel.hidden = true;
      panel.className = "grid gap-4";

      const card = el("section", "bg-white border border-line rounded-lg p-4 sm:p-5 shadow-sm grid gap-4");
      card.append(
        el("h2", "text-xl font-bold text-ink", "Manage hospital notices"),
        el("p", "text-sm text-slate2", "Create, edit, publish/withdraw, and delete notices from the admin page. Published notices appear in the public dashboard’s Notices & announcements section.")
      );

      const form = document.createElement("form");
      form.id = "admin-notice-form";
      form.className = "grid gap-3 rounded-lg border border-line bg-snow p-3 sm:p-4";
      form.setAttribute("novalidate", "");
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        void saveAdminNotice(form);
      });

      const formHeading = el("h3", "font-semibold text-ink", "Publish hospital notices");
      formHeading.dataset.adminNoticeFormHeading = "";

      const titleWrap = el("div");
      const titleLabel = el("label", "", "Notice title");
      titleLabel.setAttribute("for", "admin-notice-title");
      const titleInput = document.createElement("input");
      titleInput.id = "admin-notice-title";
      titleInput.name = "title";
      titleInput.maxLength = 150;
      titleInput.required = true;
      titleInput.className = "w-full";
      titleWrap.append(titleLabel, titleInput);

      const bodyWrap = el("div");
      const bodyLabel = el("label", "", "Notice body");
      bodyLabel.setAttribute("for", "admin-notice-body");
      const bodyInput = document.createElement("textarea");
      bodyInput.id = "admin-notice-body";
      bodyInput.name = "body";
      bodyInput.rows = 5;
      bodyInput.maxLength = 4000;
      bodyInput.required = true;
      bodyInput.className = "w-full";
      bodyWrap.append(bodyLabel, bodyInput);

      const limits = el("p", "text-xs text-mute", "Title up to 150 characters, body up to 4000 characters.");
      const status = document.createElement("output");
      status.dataset.adminNoticeStatus = "";
      status.setAttribute("aria-live", "polite");
      status.className = "block text-sm text-slate2";
      status.hidden = true;

      const actions = el("div", "flex flex-wrap gap-2");
      const submit = document.createElement("button");
      submit.type = "submit";
      submit.dataset.adminNoticeSubmit = "";
      submit.className = "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer disabled:bg-line disabled:border-line disabled:text-mute disabled:cursor-not-allowed bg-brand border-brand text-white hover:bg-brand-d min-h-10 px-3.5 py-2";
      submit.textContent = "Publish notice";

      const cancelEdit = document.createElement("button");
      cancelEdit.type = "button";
      cancelEdit.dataset.adminNoticeCancelEdit = "";
      cancelEdit.hidden = true;
      cancelEdit.className = "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow min-h-10 px-3.5 py-2";
      cancelEdit.textContent = "Cancel edit";
      cancelEdit.addEventListener("click", () => {
        setAdminNoticeFormMode("create");
      });

      const reset = document.createElement("button");
      reset.type = "button";
      reset.className = "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow min-h-10 px-3.5 py-2";
      reset.textContent = "Clear";
      reset.addEventListener("click", () => {
        if (adminNoticeState.editingId) {
          setAdminNoticeFormMode("create");
        } else {
          form.reset();
          setStatus(status, "");
        }
      });
      actions.append(submit, cancelEdit, reset);

      form.append(formHeading, titleWrap, bodyWrap, limits, status, actions);
      card.append(form);

      const listCard = el("section", "bg-white border border-line rounded-lg p-4 sm:p-5 shadow-sm grid gap-3");
      listCard.append(el("h3", "font-semibold text-ink", "All notices"));
      const listStatus = document.createElement("output");
      listStatus.dataset.adminNoticesStatus = "";
      listStatus.setAttribute("aria-live", "polite");
      listStatus.className = "block text-sm text-slate2";
      listStatus.textContent = "Loading notices…";
      const list = el("div", "grid gap-4 md:grid-cols-2");
      list.dataset.adminNotices = "";
      list.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-admin-notice-action]");
        if (!button) return;
        const action = button.dataset.adminNoticeAction;
        const noticeId = button.dataset.noticeId;
        const notice = Array.isArray(state.adminNotices)
          ? state.adminNotices.find((item) => String(item.id) === String(noticeId))
          : null;
        if (action === "edit" && notice) {
          setAdminNoticeFormMode("edit", notice);
          const titleField = form.querySelector("#admin-notice-title");
          if (titleField && typeof titleField.focus === "function") titleField.focus();
          form.scrollIntoView({ block: "nearest" });
          return;
        }
        if (action === "publish" || action === "withdraw" || action === "delete") {
          void handleAdminNoticeAction(action, noticeId, button);
        }
      });

      const pagination = el(
        "nav",
        "flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3",
      );
      pagination.dataset.adminNoticesPagination = "";
      pagination.setAttribute("aria-label", "Notice pages");
      pagination.hidden = true;
      pagination.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-admin-notices-page]");
        if (!button || button.disabled) return;
        const notices = Array.isArray(state.adminNotices) ? state.adminNotices : [];
        const pages = Math.max(1, Math.ceil(notices.length / adminNoticeState.pageSize));
        const direction = button.dataset.adminNoticesPage;
        const nextPage =
          direction === "next"
            ? adminNoticeState.page + 1
            : direction === "previous"
              ? adminNoticeState.page - 1
              : adminNoticeState.page;
        adminNoticeState.page = Math.min(Math.max(1, nextPage), pages);
        renderAdminNoticesPage();
      });

      listCard.append(listStatus, list, pagination);

      panel.append(card, listCard);
      main.append(panel);
    }

    return true;
  }

  function renderAdminNoticesPage() {
    const container = document.querySelector("[data-admin-notices]");
    const pagination = document.querySelector("[data-admin-notices-pagination]");
    if (!container) return;

    const notices = Array.isArray(state.adminNotices) ? state.adminNotices : [];
    const size = adminNoticeState.pageSize;
    const pages = Math.max(1, Math.ceil(notices.length / size));
    const page = Math.min(Math.max(1, adminNoticeState.page), pages);
    adminNoticeState.page = page;

    const start = notices.length ? (page - 1) * size : 0;
    const end = Math.min(start + size, notices.length);
    container.replaceChildren(...notices.slice(start, end).map(renderAdminNotice));

    if (!pagination) return;

    if (notices.length <= size) {
      pagination.hidden = true;
      pagination.replaceChildren();
      return;
    }

    pagination.hidden = false;

    const label = el(
      "p",
      "text-xs text-mute",
      "Showing " +
        (start + 1) +
        "–" +
        end +
        " of " +
        notices.length +
        " notices"
    );

    const controls = el("div", "flex items-center gap-2");

    const previous = el(
      "button",
      "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow disabled:bg-line disabled:border-line disabled:text-mute disabled:cursor-not-allowed min-h-9 px-3 py-1.5 text-xs",
      "Previous"
    );
    previous.type = "button";
    previous.dataset.adminNoticesPage = "previous";
    previous.disabled = page <= 1;

    const indicator = el(
      "span",
      "px-1 text-xs font-semibold text-slate2",
      "Page " + page + " of " + pages
    );

    const next = el(
      "button",
      "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow disabled:bg-line disabled:border-line disabled:text-mute disabled:cursor-not-allowed min-h-9 px-3 py-1.5 text-xs",
      "Next"
    );
    next.type = "button";
    next.dataset.adminNoticesPage = "next";
    next.disabled = page >= pages;

    controls.append(previous, indicator, next);
    pagination.replaceChildren(label, controls);
  }

  async function loadAdminNotices(options) {
    if (!ensureAdminNoticesPanel()) return false;
    const container = document.querySelector("[data-admin-notices]");
    const status = document.querySelector("[data-admin-notices-status]");
    if (!container || !status) return false;

    const settings = options || {};
    container.replaceChildren();
    const pagination = document.querySelector("[data-admin-notices-pagination]");
    if (pagination) pagination.hidden = true;
    setStatus(status, "Loading notices…");

    try {
      const notices = await callWithWakeRetry(() => MC.managerNotices(), {
        retry: true,
      });
      if (!Array.isArray(notices)) {
        throw new Error("The notice service returned an invalid response.");
      }

      state.adminNotices = notices;
      if (typeof settings.page === "number") {
        adminNoticeState.page = settings.page;
      }
      renderAdminNoticesPage();

      if (notices.length === 0) {
        setStatus(
          status,
          settings.successMessage
            ? settings.successMessage + " No notices have been created."
            : "No notices have been created."
        );
        return true;
      }

      setStatus(
        status,
        settings.successMessage || "Showing " + notices.length + " notices."
      );
      return true;
    } catch (error) {
      console.warn("Could not load admin notices:", error);
      state.adminNotices = [];
      if (pagination) pagination.hidden = true;
      setStatus(
        status,
        "Could not load notices: " + (error.message || "Unknown error"),
        true
      );
      return false;
    }
  }

  async function saveAdminNotice(form) {
    if (!form || form.dataset.busy === "true") return;

    const status = form.querySelector("[data-admin-notice-status]");
    const submit = form.querySelector('[data-admin-notice-submit]');
    const title = String(form.elements.title.value || "");
    const body = String(form.elements.body.value || "");
    const validated = ManagerUI.noticePayload(title, body);

    if (!validated.ok) {
      setStatus(status, validated.message, true);
      const field = form.elements[title.trim() ? "body" : "title"];
      if (field && typeof field.focus === "function") field.focus();
      return;
    }

    const editingId = adminNoticeState.editingId;
    const payload = {
      title: validated.payload.title,
      body: validated.payload.body,
      published: editingId ? Boolean(adminNoticeState.editingPublished) : true,
    };

    if (!ManagerUI.lockAction(submit)) return;
    form.dataset.busy = "true";
    setStatus(status, editingId ? "Saving changes…" : "Publishing notice…");

    try {
      if (editingId) {
        await callWithWakeRetry(() => MC.updateNotice(editingId, payload), {
          retry: true,
        });
      } else {
        await callWithWakeRetry(() => MC.createNotice(payload), {
          retry: false,
        });
      }

      setAdminNoticeFormMode("create");
      const refreshed = await loadAdminNotices({
        successMessage: editingId ? "Notice updated successfully." : "Notice published successfully.",
        page: 1,
      });
      if (!refreshed) {
        setStatus(
          document.querySelector("[data-admin-notices-status]"),
          (editingId ? "Notice updated successfully." : "Notice published successfully.") + " The notice list could not be refreshed.",
          true
        );
      }
      state.publicNoticesLoaded = false;
      if (activeView === "index") {
        void loadPublicNotices({ force: true });
      }
    } catch (error) {
      console.warn("Could not save admin notice:", error);
      setStatus(
        status,
        "Could not " + (editingId ? "update" : "publish") + " notice: " + (error.message || "Unknown error"),
        true
      );
    } finally {
      form.dataset.busy = "false";
      ManagerUI.unlockAction(submit);
    }
  }

  function confirmAdminNoticeDelete() {
    const status = document.querySelector("[data-admin-notices-status]");
    if (!status) return Promise.resolve(false);

    return new Promise((resolve) => {
      status.hidden = false;
      status.className = "block text-sm text-slate2";
      status.replaceChildren();

      const wrap = el("div", "flex flex-wrap items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3");
      wrap.append(
        el("span", "text-rose-900 font-medium", "Delete this notice? This cannot be undone.")
      );

      const yes = el(
        "button",
        "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-rose-600 border-rose-600 text-white hover:bg-rose-700 min-h-9 px-3 py-1.5 text-xs",
        "Yes"
      );
      yes.type = "button";
      const no = el(
        "button",
        "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow min-h-9 px-3 py-1.5 text-xs",
        "No"
      );
      no.type = "button";

      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        yes.disabled = true;
        no.disabled = true;
        status.replaceChildren();
        resolve(value);
      };

      yes.addEventListener("click", () => finish(true));
      no.addEventListener("click", () => finish(false));
      wrap.append(yes, no);
      status.append(wrap);
    });
  }

  async function handleAdminNoticeAction(action, noticeId, button) {
    const id = String(noticeId || "").trim();
    if (!id) {
      setStatus(
        document.querySelector("[data-admin-notices-status]"),
        "Could not " + action + " notice: missing notice id.",
        true
      );
      return;
    }

    if (action === "delete") {
      const confirmed = await confirmAdminNoticeDelete();
      if (!confirmed) {
        setStatus(document.querySelector("[data-admin-notices-status]"), "Delete cancelled.");
        return;
      }
    }

    const listStatus = document.querySelector("[data-admin-notices-status]");
    const canLock = !button || !window.ManagerUI || typeof ManagerUI.lockAction !== "function" || ManagerUI.lockAction(button);
    if (!canLock) return;

    setStatus(
      listStatus,
      action === "delete"
        ? "Deleting notice…"
        : action === "publish"
          ? "Publishing notice…"
          : "Withdrawing notice…"
    );

    try {
      if (action === "delete") {
        try {
          await callWithWakeRetry(() => MC.deleteNotice(id), { retry: true });
        } catch (error) {
          // A retry after a lost response reports 404 because the first request
          // already deleted the notice. That outcome still matches the intent.
          if (!error || error.status !== 404) throw error;
        }
        if (String(adminNoticeState.editingId || "") === id) {
          setAdminNoticeFormMode("create");
        }
      } else if (action === "publish") {
        await callWithWakeRetry(() => MC.publishNotice(id), { retry: true });
      } else if (action === "withdraw") {
        await callWithWakeRetry(() => MC.withdrawNotice(id), { retry: true });
      } else {
        throw new Error("Unsupported notice action.");
      }

      const successMessage =
        action === "delete"
          ? "Notice deleted successfully."
          : action === "publish"
            ? "Notice published successfully."
            : "Notice withdrawn successfully.";

      const refreshed = await loadAdminNotices({ successMessage });
      if (!refreshed) {
        setStatus(listStatus, successMessage + " The notice list could not be refreshed.", true);
      }
      state.publicNoticesLoaded = false;
      void loadPublicNotices({ force: true }).catch(() => {});
    } catch (error) {
      console.warn("Could not perform admin notice action:", error);
      setStatus(
        listStatus,
        "Could not " + action + " notice: " + (error.message || "Unknown error"),
        true
      );
    } finally {
      if (button && window.ManagerUI && typeof ManagerUI.unlockAction === "function") {
        ManagerUI.unlockAction(button);
      } else if (button) {
        button.disabled = false;
        if (button.dataset) button.dataset.busy = "false";
      }
    }
  }

  async function loadManagerReviews(options) {
    const container = document.querySelector("[data-manager-reviews]");
    const status = document.querySelector("[data-manager-reviews-status]");
    if (!container || !status) return false;

    const settings = options || {};
    container.replaceChildren();
    setStatus(status, "Loading feedback…");

    try {
      const reviews = await MC.managerReviews();
      if (!Array.isArray(reviews)) {
        throw new Error("The review service returned an invalid response.");
      }

      if (reviews.length === 0) {
        setStatus(
          status,
          settings.successMessage
            ? settings.successMessage + " No feedback is currently available."
            : "No feedback is currently available for moderation."
        );
        return true;
      }

      container.replaceChildren(...reviews.map(renderManagerReview));
      setStatus(
        status,
        settings.successMessage || "Showing " + reviews.length + " reviews."
      );
      return true;
    } catch (error) {
      console.warn("Could not load manager feedback:", error);
      setStatus(
        status,
        "Could not load feedback: " + (error.message || "Unknown error"),
        true
      );
      return false;
    }
  }

  async function moderateManagerReview(reviewId, action, button) {
    if (!reviewId || (action !== "approve" && action !== "hide") || !button) {
      return;
    }

    const card = button.closest("[data-manager-review]");
    const buttons = card ? Array.from(card.querySelectorAll("button")) : [button];

    // Refuse a second request while this card is already being moderated.
    if (!ManagerUI.lockAction(button)) return;
    buttons.forEach((item) => {
      if (item !== button) ManagerUI.lockAction(item);
    });

    const status = document.querySelector("[data-manager-reviews-status]");
    setStatus(
      status,
      action === "approve" ? "Approving feedback…" : "Hiding feedback…"
    );

    const message = action === "approve"
      ? "Feedback approved."
      : "Feedback hidden.";
    let refreshed = false;

    try {
      if (action === "approve") {
        await MC.approveReview(reviewId);
      } else {
        await MC.hideReview(reviewId);
      }

      refreshed = await loadManagerReviews();
      setStatus(
        status,
        refreshed
          ? message
          : message + " The review list could not be refreshed. Reload the page to confirm the change.",
        !refreshed
      );
    } catch (error) {
      console.warn("Could not moderate manager feedback:", error);
      setStatus(
        status,
        "Could not " + action + " feedback: " + (error.message || "Unknown error"),
        true
      );
    } finally {
      // A successful refresh replaces these nodes; otherwise let the
      // manager retry instead of leaving the card permanently disabled.
      if (!refreshed) {
        buttons.forEach((item) => ManagerUI.unlockAction(item));
      }
    }
  }

  async function loadManagerReception(options) {
    const tbody = document.querySelector("[data-manager-reception-tbody]");
    if (!tbody) return;

    const settings = options || {};
    const status = document.querySelector("[data-manager-reception-status]");

    if (!settings.silent && status) {
      status.hidden = false;
      status.textContent = "Loading today’s appointments…";
      status.classList.remove("text-rose-600");
    }

    try {
      const list = await MC.adminAppointments();
      const today = todayISO();
      state.manager.reception = (Array.isArray(list) ? list : []).filter(
        (appointment) => appointment.sessionDate === today
      );
      state.manager.receptionLoaded = true;
      renderManagerReception();
      if (status) {
        if (state.manager.reception.length === 0) {
          status.hidden = false;
          status.textContent = "No appointments are booked for today yet.";
        } else {
          status.hidden = true;
        }
      }
    } catch (error) {
      console.warn("Could not load reception appointments:", error);
      tbody.innerHTML =
        '<tr><td colspan="6" class="text-center py-4 text-rose-600">Could not load today’s appointments: ' +
        escapeHtml(error.message || "Unknown error") +
        "</td></tr>";
      if (status) {
        status.hidden = false;
        status.textContent = "Reception could not be loaded. Try again in a moment.";
      }
    }
  }

  function managerReceptionMatches(appointment, term) {
    if (!term) return true;
    const needle = term.trim().toLowerCase();
    if (!needle) return true;
    return [
      appointment.bookingReference,
      referenceOf(appointment.bookingReference),
      appointment.appointmentNumber != null ? "#" + appointment.appointmentNumber : "",
      appointment.patientName,
      appointment.doctorName,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  }

  function paymentLabel(appointment) {
    const status = appointment.paymentStatus || "PENDING";
    if (status === "PAID") {
      return appointment.paymentMethod
        ? "Paid · " + titleCase(appointment.paymentMethod)
        : "Paid";
    }
    if (status === "REFUNDED") return "Refunded";
    return "Pending";
  }

  function renderManagerReception() {
    const tbody = document.querySelector("[data-manager-reception-tbody]");
    if (!tbody) return;

    const search = document.querySelector("#manager-f");
    const term = search ? search.value : "";
    const list = state.manager.reception.filter((appointment) =>
      managerReceptionMatches(appointment, term)
    );

    if (list.length === 0) {
      const tr = document.createElement("tr");
      const td = el(
        "td",
        "text-center py-4 text-mute",
        state.manager.reception.length === 0
          ? "No appointments are booked for today."
          : "No appointments match your search."
      );
      td.colSpan = 6;
      tr.append(td);
      tbody.replaceChildren(tr);
      return;
    }

    tbody.replaceChildren();
    list.forEach((appointment) => {
      const tr = document.createElement("tr");
      const reference = referenceOf(appointment.bookingReference);
      const status = appointment.status || "BOOKED";
      const canCancel = status === "BOOKED" || status === "ARRIVED";

      const tdRef = el("td", "text-xs font-mono text-slate2", reference);
      tdRef.dataset.label = "Ref";

      const tdPatient = document.createElement("td");
      tdPatient.dataset.label = "Patient";
      tdPatient.append(
        el("div", "font-semibold text-ink", appointment.patientName || "Patient")
      );
      tdPatient.append(
        el("div", "text-xs text-mute", appointment.doctorName || "Doctor")
      );

      const tdNumber = el(
        "td",
        "",
        appointment.appointmentNumber != null
          ? "#" + appointment.appointmentNumber
          : "—"
      );
      tdNumber.dataset.label = "No.";

      const tdStatus = document.createElement("td");
      tdStatus.dataset.label = "Status";
      tdStatus.append(appointmentBadge(status));

      const tdPayment = el("td", "text-sm text-slate2", paymentLabel(appointment));
      tdPayment.dataset.label = "Payment";

      const tdActions = document.createElement("td");
      tdActions.dataset.label = "Actions";
      const actions = document.createElement("div");
      actions.className = "flex flex-wrap items-center gap-1.5";

      if (status === "BOOKED") {
        const arrive = el(
          "button",
          "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-brand border-brand text-white hover:bg-brand-d min-h-9 sm:min-h-8 px-2.5 py-1 text-xs",
          "Mark arrived"
        );
        arrive.type = "button";
        arrive.dataset.arriveAppointment = appointment.appointmentId;
        actions.append(arrive);
      }

      if (appointment.paymentStatus !== "PAID" && status !== "CANCELLED") {
        const pay = el(
          "button",
          "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-white border-line text-slate2 hover:bg-snow hover:text-ink min-h-9 sm:min-h-8 px-2.5 py-1 text-xs",
          "Record payment"
        );
        pay.type = "button";
        pay.dataset.payAppointment = appointment.appointmentId;
        actions.append(pay);
      }

      if (canCancel) {
        const cancel = el(
          "button",
          "inline-flex items-center gap-1.5 border rounded-lg font-semibold cursor-pointer bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 min-h-9 sm:min-h-8 px-2.5 py-1 text-xs",
          "Cancel"
        );
        cancel.type = "button";
        cancel.dataset.cancelAppointment = appointment.appointmentId;
        actions.append(cancel);
      }

      if (!actions.childElementCount) {
        actions.append(el("span", "text-xs text-mute", "—"));
      }

      tdActions.append(actions);
      tr.append(tdRef, tdPatient, tdNumber, tdStatus, tdPayment, tdActions);
      tbody.append(tr);
    });
  }

  async function markManagerArrived(appointmentId, button) {
    if (!appointmentId) return;

    if (button) {
      button.disabled = true;
      button.textContent = "Marking…";
    }

    try {
      await MC.markAppointmentArrived(appointmentId);
      await loadManagerReception({ silent: true });
    } catch (error) {
      setAppMessage(error.message);
      if (button) {
        button.disabled = false;
        button.textContent = "Mark arrived";
      }
    }
  }

  async function handleManagerCreateSession(form) {
    const status = form.querySelector("[data-create-session-status]");
    const button = form.querySelector("button[type=submit]");

    const doctorId = ($("sess-doc") || {}).value || "";
    const consultationType = ($("sess-type") || {}).value || "PHYSICAL";
    const roomId = consultationType === "PHYSICAL" ? (($("sess-room") || {}).value || null) : null;
    const sessionDate = ($("sess-date") || {}).value || "";
    let startTime = ($("sess-start") || {}).value || "";
    let endTime = ($("sess-end") || {}).value || "";
    const feeLkr = Number(($("sess-fee") || {}).value || 0);
    const maxAppointments = Number(($("sess-max") || {}).value || 16);
    const minutesPerPatient = Number(($("sess-mins") || {}).value || 10);

    if (!doctorId) {
      setStatus(status, "Please select a doctor.", true);
      return;
    }
    if (consultationType === "PHYSICAL" && !roomId) {
      setStatus(status, "Please select a consultation room for physical sessions.", true);
      return;
    }
    if (!sessionDate) {
      setStatus(status, "Please select a session date.", true);
      return;
    }
    if (!startTime || !endTime) {
      setStatus(status, "Please provide start and end times.", true);
      return;
    }

    if (startTime.length === 5) startTime += ":00";
    if (endTime.length === 5) endTime += ":00";

    if (startTime >= endTime) {
      setStatus(status, "End time must be after start time.", true);
      return;
    }

    if (!Number.isFinite(maxAppointments) || maxAppointments < 1 || maxAppointments > 60) {
      setStatus(status, "Maximum patients must be between 1 and 60 (BR-01).", true);
      return;
    }
    if (!Number.isFinite(minutesPerPatient) || minutesPerPatient < 5 || minutesPerPatient > 30) {
      setStatus(status, "Minutes per patient must be between 5 and 30 (BR-01).", true);
      return;
    }
    if (!Number.isFinite(feeLkr) || feeLkr <= 0) {
      setStatus(status, "Consultation fee must be greater than 0 LKR (BR-01).", true);
      return;
    }

    const payload = {
      doctorId,
      roomId,
      sessionDate,
      startTime,
      endTime,
      consultationType,
      maxAppointments,
      minutesPerPatient,
      feeLkr,
    };

    if (button) button.disabled = true;
    setStatus(status, "Creating session…");

    try {
      const result = await MC.createSession(payload);
      const docName = $("sess-doc") && $("sess-doc").selectedOptions[0] ? $("sess-doc").selectedOptions[0].textContent : "the doctor";
      setStatus(
        status,
        "Session successfully created for " + docName + "! The session is open and ready for patient booking."
      );
      showNotificationToast({
        title: "Session scheduled",
        message: "New consultation session scheduled for " + docName + " on " + sessionDate + " (" + startTime.slice(0, 5) + " - " + endTime.slice(0, 5) + ").",
      });

      invalidateManagerDashboard();
      void loadManagerSessions();
      state.sessionsLoaded = false;
      void loadSessions();
      void loadAuditLogs();
    } catch (err) {
      setStatus(status, err.message || "Failed to create session.", true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  function printSummary() {
    const appointment = state.consult.appointment;
    const summary = state.consult.summary;

    if (!appointment || !summary) {
      setAppMessage("The summary is not available yet.");
      return;
    }

    const printWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!printWindow) {
      window.print();
      return;
    }

    const documentTitle = document.createElement("title");
    documentTitle.textContent = "MediChannel consultation summary";

    const style = document.createElement("style");
    style.textContent =
      "body{font:14px system-ui,sans-serif;margin:32px;color:#1a202c}h1{font-size:20px}h2{font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:#718096;margin-top:20px}";

    const body = printWindow.document.body;
    body.replaceChildren();
    printWindow.document.head.append(documentTitle, style);

    body.append(el("h1", "", "MediChannel · Consultation summary"));
    body.append(
      el(
        "p",
        "",
        "Patient: " +
          (S.role === "DOCTOR"
            ? appointment.patientName || "Patient"
            : S.email) +
          " · Reference " +
          referenceOf(appointment.bookingReference)
      )
    );
    body.append(el("h2", "", "Diagnosis"));
    body.append(el("p", "", summary.diagnosis || "—"));
    body.append(el("h2", "", "Advice and prescription"));
    body.append(
      el("p", "", summary.prescription || summary.treatmentNotes || "—")
    );
    body.append(el("h2", "", "Follow-up"));
    body.append(el("p", "", summary.followUpInstructions || "—"));

    printWindow.focus();
    printWindow.print();
  }

  // ---------------------------------------------------------------
  // Authentication forms and validation
  // ---------------------------------------------------------------

  const V = {
    name: (value) =>
      value.trim().length < 3 && "Please enter your full name.",
    nic: (value) =>
      !/^(\d{9}[VvXx]|\d{12})$/.test(value.trim()) &&
      "That NIC doesn’t look right. Use 9 digits + V/X, or 12 digits.",
    dob: (value) =>
      (!value ||
        new Date(value) > new Date() ||
        new Date(value) < new Date("1900-01-01")) &&
      "Please choose your date of birth.",
    phone: (value) =>
      !/^07\d{8}$/.test(value.trim()) &&
      "Please enter your phone number like 07XXXXXXXX.",
    email: (value) =>
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) &&
      "Please enter a valid email address.",
    pw: (value) =>
      !(
        value.length >= 8 &&
        /[A-Za-z]/.test(value) &&
        /\d/.test(value) &&
        /[^A-Za-z0-9]/.test(value)
      ) && "Use at least 8 characters, with a letter, a number and a symbol.",
    pw2: (value, form) =>
      value !== form.elements.password.value &&
      "The passwords don’t match yet.",
    req: (value) => !value && "Please fill this in.",
  };

  function chk(element) {
    const validator = V[element.dataset.v];
    if (!validator) return true;

    const message = validator(element.value, element.form) || "";
    const parts = element.id.split("-");

    element.setAttribute("aria-invalid", message ? "true" : "false");

    const error = $(parts[0] + "-e_" + parts[1]);
    if (error) error.textContent = message;

    return !message;
  }

  function allOk(form) {
    return Array.from(form.querySelectorAll("[data-v]"))
      .map(chk)
      .every(Boolean);
  }

  function showErr(id, message) {
    const box = $(id);
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
  }

  async function handleLogin(event) {
    event.preventDefault();

    const form = event.target;
    const error = $("login-err");
    const success = $("login-ok");

    if (error) error.hidden = true;
    if (success) success.hidden = true;

    if (!allOk(form)) return;

    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: form.email.value.trim(),
          password: form.password.value,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        showErr(
          "login-err",
          result.message || "That email or password doesn’t look right."
        );
        return;
      }

      if (!result.user || !HOME[result.user.role]) {
        showErr("login-err", "The login service returned an unexpected response.");
        return;
      }

      if (result.token) {
        try {
          sessionStorage.setItem("mc_tab_token", result.token);
        } catch {}
      }

      setSession(result.user);
      form.reset();
      render();

      if (S.role === "CUSTOMER") {
        setAppMessage("");
        nav("index");
      } else {
        setAppMessage("");
        nav(HOME[S.role]);
      }
    } catch {
      showErr("login-err", "Unable to reach the login service. Please try again.");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function handleRegister(event) {
    event.preventDefault();

    const form = event.target;
    const error = $("register-err");

    if (error) error.hidden = true;

    if (!allOk(form)) return;

    const values = Object.fromEntries(new FormData(form));
    const parts = String(values.name || "").trim().split(/\s+/);
    const firstName = parts.shift() || "";
    const lastName = parts.join(" ");

    if (!firstName || !lastName) {
      showErr("register-err", "Enter your first and last name.");
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          firstName,
          lastName,
          email: values.email,
          password: values.password,
          confirmPassword: values.confirm,
          nic: values.nic,
          dateOfBirth: values.dob,
          gender: values.gen,
          phone: values.ph,
          address: values.address,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (response.status === 202) {
        showErr("register-err", result.message || "Your account is awaiting activation.");
        return;
      }

      if (!response.ok) {
        showErr(
          "register-err",
          result.message || "We couldn’t create your account just now."
        );
        return;
      }

      if (result.user && HOME[result.user.role]) {
        if (result.token) {
          try {
            sessionStorage.setItem("mc_tab_token", result.token);
          } catch {}
        }
        setSession(result.user);
        form.reset();
        render();
        nav(HOME[result.user.role]);
        return;
      }

      flash = "Your account and patient profile are ready. Please log in.";
      form.reset();
      nav("login");
    } catch {
      showErr("register-err", "Unable to reach the registration service.");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function logout(button) {
    if (button) button.disabled = true;

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // Clear locally regardless.
    }

    S = null;
    try {
      sessionStorage.removeItem("mc_tab_token");
      sessionStorage.removeItem("mc_tab_user");
    } catch {}
    disconnectRealtime();
    state.appointments = [];
    state.appointmentsLoaded = false;
    state.doctor = {
      sessions: [],
      sessionsLoaded: false,
      sessionId: null,
      queue: null,
      selected: null,
      summary: null,
      queueTimer: null,
    };
    state.consult.appointmentId = null;
    state.consult.requestedId = null;
    state.consult.appointment = null;
    state.consult.summary = null;
    state.consult.list = [];
    state.notifications = [];
    state.notificationsLoaded = false;
    if (state.auditLogTimer) clearInterval(state.auditLogTimer);
    state.auditLogTimer = null;
    unsubscribe("admin-audit-logs");
    renderNotificationBadge(0);
    render();
    hideQueue();
    nav("welcome");
  }

  // ---------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------

  document.addEventListener("focusout", (event) => {
    if (event.target.dataset && event.target.dataset.v) {
      chk(event.target);
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target;

    if (target.dataset && target.dataset.v && target.getAttribute("aria-invalid") === "true") {
      chk(target);
    }

    if (target.id === "manager-f") {
      renderManagerReception();
      return;
    }

    if (target.id === "register-pw") {
      const score = [
        target.value.length >= 8,
        /[A-Za-z]/.test(target.value),
        /\d/.test(target.value),
        /[^A-Za-z0-9]/.test(target.value),
      ].filter(Boolean).length;

      const strength = $("register-st");
      if (strength) {
        strength.style.width = (score / 4) * 100 + "%";
        strength.style.background =
          score >= 3 ? "#38A169" : score === 2 ? "#D69E2E" : "#E53E3E";
      }
    }
  });

  document.addEventListener("click", async (event) => {
    if (!event.target.closest("[data-notification-wrapper]")) {
      document.querySelectorAll("[data-notification-popover]").forEach((p) => {
        p.hidden = true;
      });
    }

    const bellBtn = event.target.closest("[data-notification-bell]");
    if (bellBtn) {
      const wrapper = bellBtn.closest("[data-notification-wrapper]");
      if (wrapper) {
        const popover = wrapper.querySelector("[data-notification-popover]");
        if (popover) {
          const wasHidden = popover.hidden;
          document.querySelectorAll("[data-notification-popover]").forEach((p) => {
            p.hidden = true;
          });
          popover.hidden = !wasHidden;
          if (!popover.hidden) {
            renderNotificationPopover(popover);
          }
        }
      }
      return;
    }

    if (event.target.closest("[data-mark-all-read]")) {
      const btn = event.target.closest("[data-mark-all-read]");
      btn.disabled = true;
      try {
        if (typeof MC.markAllNotificationsRead === "function") {
          await MC.markAllNotificationsRead();
        }
        (state.notifications || []).forEach((n) => { n.read = true; });
        renderNotificationBadge(0);
        const popover = btn.closest("[data-notification-popover]");
        if (popover) renderNotificationPopover(popover);
      } catch (e) {
        console.warn("Could not mark all read:", e);
      } finally {
        btn.disabled = false;
      }
      return;
    }

    if (event.target.closest("[data-refresh-audit]")) {
      const btn = event.target.closest("[data-refresh-audit]");
      btn.disabled = true;
      try {
        await loadAuditLogs();
      } finally {
        btn.disabled = false;
      }
      return;
    }

    if (event.target.closest("[data-refresh-sessions]")) {
      const btn = event.target.closest("[data-refresh-sessions]");
      btn.disabled = true;
      try {
        invalidateManagerDashboard();
        await loadManagerSessions();
      } finally {
        btn.disabled = false;
      }
      return;
    }

    const delaySessionBtn = event.target.closest("[data-delay-session]");
    if (delaySessionBtn) {
      const sessionId = delaySessionBtn.getAttribute("data-delay-session");
      if (sessionId) {
        delaySessionBtn.disabled = true;
        try {
          await MC.delaySession(sessionId, 15);
          showNotificationToast({
            title: "Session delayed",
            message: "Session delayed by 15 minutes. Booked patients notified.",
          });
          invalidateManagerDashboard();
          await loadManagerSessions();
          state.sessionsLoaded = false;
          void loadSessions();
          void loadAuditLogs();
        } catch (err) {
          setAppMessage(err.message || "Failed to delay session.");
          delaySessionBtn.disabled = false;
        }
      }
      return;
    }

    const cancelSessionBtn = event.target.closest("[data-cancel-session]");
    if (cancelSessionBtn) {
      const sessionId = cancelSessionBtn.getAttribute("data-cancel-session");
      if (sessionId) {
        if (!confirm("Are you sure you want to cancel this session? Booked patients will be notified.")) {
          return;
        }
        cancelSessionBtn.disabled = true;
        try {
          await MC.cancelSession(sessionId);
          showNotificationToast({
            title: "Session cancelled",
            message: "Session cancelled. Booked patients notified.",
          });
          invalidateManagerDashboard();
          await loadManagerSessions();
          state.sessionsLoaded = false;
          void loadSessions();
          void loadAuditLogs();
        } catch (err) {
          setAppMessage(err.message || "Failed to cancel session.");
          cancelSessionBtn.disabled = false;
        }
      }
      return;
    }

    if (event.target.closest("[data-refresh-staff]")) {
      const btn = event.target.closest("[data-refresh-staff]");
      btn.disabled = true;
      try {
        await loadStaffAccounts();
        await loadAdminStats();
      } finally {
        btn.disabled = false;
      }
      return;
    }

    if (event.target.closest("[data-refresh-rooms]")) {
      const btn = event.target.closest("[data-refresh-rooms]");
      btn.disabled = true;
      try {
        await loadAdminRooms();
      } finally {
        btn.disabled = false;
      }
      return;
    }

    const toggleBtn = event.target.closest("[data-toggle-user]");
    if (toggleBtn) {
      const userId = toggleBtn.getAttribute("data-toggle-user");
      const action = toggleBtn.getAttribute("data-action");
      if (userId) {
        toggleBtn.disabled = true;
        try {
          if (action === "suspend") {
            await MC.adminSuspendUser(userId);
          } else {
            await MC.adminActivateUser(userId);
          }
          await loadStaffAccounts();
        } catch (err) {
          setAppMessage(err.message || "Failed to update user status.");
          toggleBtn.disabled = false;
        }
      }
      return;
    }

    const editUserBtn = event.target.closest("[data-edit-user]");
    if (editUserBtn) {
      openEditAccount(editUserBtn.getAttribute("data-edit-user"));
      return;
    }

    const deleteUserBtn = event.target.closest("[data-delete-user]");
    if (deleteUserBtn) {
      openDeleteAccount(deleteUserBtn.getAttribute("data-delete-user"));
      return;
    }

    const fillLoginBtn = event.target.closest("[data-fill-login]");
    if (fillLoginBtn) {
      const [email, password] = (fillLoginBtn.getAttribute("data-fill-login") || "").split("|");
      const emailInput = $("login-em");
      const pwInput = $("login-pw");
      if (emailInput && email) {
        emailInput.value = email;
        emailInput.setAttribute("aria-invalid", "false");
      }
      if (pwInput && password) {
        pwInput.value = password;
        pwInput.setAttribute("aria-invalid", "false");
      }
      const err = $("login-err");
      if (err) err.hidden = true;
      const emErr = $("login-e_em");
      if (emErr) emErr.textContent = "";
      const pwErr = $("login-e_pw");
      if (pwErr) pwErr.textContent = "";
      return;
    }

    const showButton = event.target.closest("[data-show]");
    if (showButton) {
      const input = $(showButton.closest("[data-view]").dataset.view + "-" + showButton.dataset.show);
      if (input) {
        input.type = input.type === "password" ? "text" : "password";
        showButton.textContent = input.type === "password" ? "Show" : "Hide";
      }
      return;
    }

    if (event.target.closest("[data-out]")) {
      void logout(event.target.closest("[data-out]"));
      return;
    }

    if (event.target.closest("[data-wake-retry]")) {
      void wakeBackend();
      return;
    }

    const panelLink = event.target.closest("[data-panel-link]");
    if (panelLink) {
      event.preventDefault();
      activatePanel(panelLink.closest("[data-view]"), panelLink);
      return;
    }

    const book = event.target.closest("[data-book-session]");
    if (book) {
      const session = state.sessions.find(
        (item) => item.sessionId === book.dataset.bookSession
      );
      if (session) selectSession(session);
      return;
    }

    if (event.target.closest("[data-booking-confirm]")) {
      void confirmBooking();
      return;
    }

    const payBookingButton = event.target.closest("[data-booking-pay]");
    if (payBookingButton) {
      void payBooking(payBookingButton.dataset.bookingPay);
      return;
    }

    if (event.target.closest("[data-booking-goto]")) {
      nav("appointments");
      return;
    }

    const payRow = event.target.closest("[data-pay-appointment]");
    if (payRow) {
      void payAppointment(payRow.dataset.payAppointment, payRow);
      return;
    }

    const checkin = event.target.closest("[data-checkin-appointment]");
    if (checkin) {
      void checkInAppointment(checkin.dataset.checkinAppointment);
      return;
    }

    const cancel = event.target.closest("[data-cancel-appointment]");
    if (cancel) {
      void cancelAppointment(cancel.dataset.cancelAppointment, cancel);
      return;
    }

    const arrive = event.target.closest("[data-arrive-appointment]");
    if (arrive) {
      void markManagerArrived(arrive.dataset.arriveAppointment, arrive);
      return;
    }

    const reviewAction = event.target.closest("[data-review-action]");
    if (reviewAction) {
      void moderateManagerReview(
        reviewAction.dataset.reviewId,
        reviewAction.dataset.reviewAction,
        reviewAction
      );
      return;
    }

    const openConsult = event.target.closest("[data-open-consult]");
    if (openConsult) {
      state.consult.requestedId = openConsult.dataset.openConsult;
      nav("consult");
      return;
    }

    const doctorRowAction = event.target.closest("[data-doctor-action]");
    if (doctorRowAction) {
      void runDoctorAction(
        doctorRowAction.dataset.doctorAction,
        doctorRowAction.dataset.doctorId,
        doctorRowAction
      );
      return;
    }

    if (event.target.closest("[data-doctor-refresh]")) {
      void loadDoctorQueue(state.doctor.sessionId);
      return;
    }

    if (event.target.closest("[data-appointments-refresh]")) {
      void loadAppointments();
      return;
    }

    if (event.target.closest("[data-save-summary]")) {
      void saveDoctorSummary();
      return;
    }

    if (event.target.closest("[data-print-summary]")) {
      printSummary();
      return;
    }

    if (event.target.closest("[data-consult-summary-toggle]")) {
      const form = document.querySelector("[data-consult-summary-form]");
      if (form) form.hidden = !form.hidden;
      return;
    }

    if (event.target.closest("[data-consult-summary-cancel]")) {
      const form = document.querySelector("[data-consult-summary-form]");
      if (form) form.hidden = true;
      return;
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.id === "doctor-session-select" || event.target.id === "doctor-queue-session-select") {
      const val = event.target.value;
      state.doctor.sessionId = val;
      const other = event.target.id === "doctor-session-select"
        ? $("doctor-queue-session-select")
        : $("doctor-session-select");
      if (other) other.value = val;
      void loadDoctorQueue(val);
      return;
    }

    if (event.target.id === "doctor-notes-date") {
      void syncDoctorNotesSessions(event.target.value);
      return;
    }

    if (event.target.id === "doctor-notes-session") {
      void syncDoctorNotesPatients(event.target.value);
      return;
    }

    if (event.target.id === "consult-pick") {
      const select = event.target;
      const scrollY = window.scrollY;
      if (select && select.blur) select.blur();
      void openConsultation(select.value).then(() => {
        window.scrollTo({ top: scrollY, behavior: "instant" });
      });
      return;
    }

    if (event.target.id === "doctor-notes-pick") {
      const select = event.target;
      const scrollY = window.scrollY;
      if (select && select.blur) select.blur();
      const chosen = (state.doctor.sessionAppointments || []).find(
        (a) => a.appointmentId === select.value
      ) || (state.doctor.allAppointments || []).find(
        (a) => a.appointmentId === select.value
      );
      if (chosen) {
        void selectNotes(chosen).then(() => {
          window.scrollTo({ top: scrollY, behavior: "instant" });
        });
      }
    }
  });

  const loginForm = $("login-f");
  if (loginForm) loginForm.addEventListener("submit", handleLogin);

  const registerForm = $("register-f");
  if (registerForm) registerForm.addEventListener("submit", handleRegister);

  const searchForm = document.querySelector('form[aria-label="Search sessions"]');
  if (searchForm) {
    searchForm.addEventListener("submit", (event) => {
      event.preventDefault();
      state.sessionsLoaded = false;
      void loadSessions();
    });
  }

  const chatForm = document.querySelector("[data-chat-form]");
  if (chatForm) {
    chatForm.addEventListener("submit", (event) => {
      event.preventDefault();
      sendChatMessage();
    });
  }

  const chatInput = $("consult-c");
  if (chatInput) chatInput.addEventListener("input", handleTypingInput);

  const feedbackForm = document.querySelector("[data-feedback-form]");
  if (feedbackForm) {
    feedbackForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitFeedback();
    });
  }

  const consultSummaryForm = document.querySelector("[data-consult-summary-form]");
  if (consultSummaryForm) {
    consultSummaryForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void submitConsultSummary(event);
    });
  }

  document.querySelectorAll("[data-create-scope]").forEach((form) => {
    syncCreateFormRole(form);

    const roleSelect = form.querySelector("[data-role-select]");
    if (roleSelect) {
      roleSelect.addEventListener("change", () => syncCreateFormRole(form));
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void handleCreateAccount(form);
    });
  });

  const editAccountForm = $("edit-account-form");
  if (editAccountForm) {
    editAccountForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = editAccountForm.querySelector("[data-edit-status]");
      const save = editAccountForm.querySelector("[data-edit-save]");
      const role = editAccountForm.dataset.role;
      const userId = editAccountForm.dataset.userId;
      const doctorId = editAccountForm.dataset.doctorId;

      const field = (name) => {
        const input = editAccountForm.querySelector(`[data-edit-field="${name}"]`);
        return input ? String(input.value || "").trim() : "";
      };

      if (save) save.disabled = true;
      setStatus(status, "Saving changes…");

      try {
        if (role === "DOCTOR") {
          if (!doctorId) {
            throw new Error("This doctor has no clinical profile to edit.");
          }
          const firstName = field("firstName");
          const lastName = field("lastName");
          const registrationNumber = field("registrationNumber");
          const specialisationId = field("specialisationId");
          const consultationFee = Number(field("consultationFee") || 0);

          if (!firstName || !lastName || !registrationNumber ||
              !specialisationId || !(consultationFee >= 0)) {
            throw new Error("Please fill in every required doctor field.");
          }

          await MC.adminUpdateDoctor(doctorId, {
            firstName,
            lastName,
            registrationNumber,
            qualification: field("qualification"),
            specialisationId,
            consultationFee,
          });
        } else {
          const email = field("email");
          if (!email) {
            throw new Error("Please enter an email address.");
          }
          await MC.adminUpdateUser(userId, { email });
        }

        const dialog = $("edit-account-dialog");
        if (dialog) dialog.close();
        await loadStaffAccounts();
        void loadAdminStats();
        void loadAuditLogs();
      } catch (error) {
        setStatus(status, error.message || "Unable to save the account.", true);
      } finally {
        if (save) save.disabled = false;
      }
    });
  }

  const editCancel = document.querySelector("[data-edit-cancel]");
  if (editCancel) {
    editCancel.addEventListener("click", () => {
      const dialog = $("edit-account-dialog");
      if (dialog) dialog.close();
    });
  }

  const deleteAccountForm = $("delete-account-form");
  if (deleteAccountForm) {
    const confirmInput = deleteAccountForm.querySelector("[data-delete-confirm]");
    const deleteSubmit = deleteAccountForm.querySelector("[data-delete-submit]");

    if (confirmInput && deleteSubmit) {
      confirmInput.addEventListener("input", () => {
        deleteSubmit.disabled = confirmInput.value.trim() !== "DELETE";
      });
    }

    deleteAccountForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const status = deleteAccountForm.querySelector("[data-delete-status]");
      const userId = deleteAccountForm.dataset.userId;

      if (!confirmInput || confirmInput.value.trim() !== "DELETE") {
        setStatus(status, "Type DELETE exactly to confirm.", true);
        return;
      }

      if (deleteSubmit) deleteSubmit.disabled = true;
      setStatus(status, "Deleting account…");

      try {
        await MC.adminDeleteUser(userId);
        const dialog = $("delete-account-dialog");
        if (dialog) dialog.close();
        await loadStaffAccounts();
        void loadAdminStats();
        void loadAuditLogs();
      } catch (error) {
        setStatus(status, error.message || "Unable to delete the account.", true);
        if (deleteSubmit) deleteSubmit.disabled = false;
      }
    });
  }

  const deleteCancel = document.querySelector("[data-delete-cancel]");
  if (deleteCancel) {
    deleteCancel.addEventListener("click", () => {
      const dialog = $("delete-account-dialog");
      if (dialog) dialog.close();
    });
  }

  const adminCreateRoomForm = document.querySelector("[data-admin-create-room-form]");
  if (adminCreateRoomForm) {
    adminCreateRoomForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void handleAdminCreateRoom(adminCreateRoomForm);
    });
  }

  const managerCreateSessionForm = document.querySelector("[data-manager-create-session]");
  if (managerCreateSessionForm) {
    managerCreateSessionForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void handleManagerCreateSession(managerCreateSessionForm);
    });
  }

  const sessDoc = $("sess-doc");
  if (sessDoc) {
    sessDoc.addEventListener("change", () => {
      const opt = sessDoc.selectedOptions[0];
      if (opt && opt.dataset.fee && $("sess-fee")) {
        $("sess-fee").value = opt.dataset.fee;
      }
    });
  }

  const sessType = $("sess-type");
  if (sessType) {
    sessType.addEventListener("change", () => {
      const roomSelect = $("sess-room");
      if (!roomSelect) return;
      if (sessType.value === "ONLINE") {
        roomSelect.value = "";
        roomSelect.disabled = true;
      } else {
        roomSelect.disabled = false;
      }
    });
  }

  window.addEventListener("hashchange", () => go());

  window.addEventListener("pageshow", () => {
    if (document.body.dataset.appReady === "true" && S) {
      void refreshPatientQueue();
    }
  });

  window.addEventListener("online", () => {
    void wakeBackend();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void wakeBackend();
  });

  // ---------------------------------------------------------------
  // Localisation (English / Sinhala)
  // ---------------------------------------------------------------

  let lang = "en";
  try {
    lang = localStorage.getItem("mc-lang") || "en";
  } catch {
    // Storage can be unavailable in private modes.
  }

  const D = {
  "Choose a doctor and a time. Get your number instantly.": "වෛද්‍යවරයෙකු සහ වේලාවක් තෝරන්න. ඔබේ අංකය වහාම ලබාගන්න.",
  "See who is being called now. We’ll alert you when your turn is near.": "දැන් අමතන්නේ කාවදැයි බලන්න. ඔබේ වාරය ළඟා වූ විට අපි දැනුම් දෙන්නෙමු.",
  "Your health details are encrypted. Only you and your doctor can read them.": "ඔබේ සෞඛ්‍ය තොරතුරු සංකේතනය කර ඇත. කියවිය හැක්කේ ඔබට සහ ඔබේ වෛද්‍යවරයාට පමණි.",
  "Welcome to Lanka Care Hospital, Colombo": "ලංකා කෙයාර් රෝහල, කොළඹ වෙත සාදරයෙන් පිළිගනිමු",
  "We’re glad you’re here. Book a visit, follow your number live, or chat with your doctor online, so you spend less time waiting and more time feeling better.": "ඔබ අප වෙත පැමිණීම ගැන සතුටුයි. වෙන්කිරීමක් කරන්න, ඔබේ අංකය සජීවීව බලන්න, නැතහොත් වෛද්‍යවරයා සමඟ මාර්ගගතව කතා කරන්න; බලා සිටීමට අඩුවෙන් සහ සුවය ලැබීමට වැඩි කාලයක් වැය කරන්න.",
  "Create a free account": "නොමිලේ ගිණුමක් සාදන්න",
  "— it only takes a minute.": "— එයට මිනිත්තුවක් පමණක් ගත වේ.",
  "Your doctor,": "ඔබේ වෛද්‍යවරයා,",
  "one tap away": "එක ස්පර්ශයකින්",
  "Free to join": "නොමිලේ සම්බන්ධ වන්න",
  "Encrypted data": "සංකේතනය කළ දත්ත",
  "No phone queues": "දුරකථන පෝලිම් නැත",
  "How it works": "එය ක්‍රියා කරන ආකාරය",
  "Three simple steps to see your doctor.": "වෛද්‍යවරයා හමුවීමට සරල පියවර තුනක්.",
  "✓ Booked · #14": "✓ වෙන්කළා · #14",
  "Booked · #14": "වෙන්කළා · #14",
  "Visiting doctors": "පැමිණෙන වෛද්‍යවරු",
  "Specialisations": "විශේෂත්වයන්",
  "Sessions every week": "සතියකට සැසි",
  "You’re booked in!": "වෙන්කිරීම සාර්ථකයි!",
  "Doctor is seeing patients now": "වෛද්‍යවරයා දැන් රෝගීන් බලමින් සිටී",
  "Now calling": "දැන් අමතන අංකය",
  "4 people ahead of you": "ඔබට පෙර පුද්ගලයන් 4ක්",
  "Your estimated time": "ඔබේ ඇස්තමේන්තු වේලාව",
  "Your turn is expected around 19:10. We’ll let you know when you’re 3 numbers away, and again when the doctor calls you.": "ඔබේ වාරය 19:10 පමණ වනු ඇත. ඔබට අංක 3ක් තිබෙන විටත්, වෛද්‍යවරයා ඔබව ඇමතූ විටත් අපි දැනුම් දෙන්නෙමු.",
  "Your visits, past and upcoming": "ඔබේ පසුගිය සහ ඉදිරි හමුවීම්",
  "Booking ref": "වෙන්කිරීමේ යොමුව",
  "When": "කවදාද",
  "Visit type": "හමුවීමේ වර්ගය",
  "Not paid yet": "තවම ගෙවා නැත",
  "Too late to cancel": "අවලංගු කිරීමට ප්‍රමාදයි",
  "Cancelled, kept in your history": "අවලංගු කළා; ඔබේ ඉතිහාසයේ තබා ඇත",
  "View summary & leave feedback": "සාරාංශය බලා ප්‍රතිචාර දෙන්න",
  "Cancel booking": "වෙන්කිරීම අවලංගු කරන්න",
  "You can cancel an unpaid appointment up to 3 hours before it starts. Cancelled appointments stay in your history.": "නොගෙවූ වෙන්කිරීමක් ආරම්භයට පැය 3කට පෙර දක්වා අවලංගු කළ හැක. අවලංගු කළ වෙන්කිරීම් ඔබේ ඉතිහාසයේ රැඳේ.",
  "Reference": "යොමුව",
  "Your reference is MC-20261109-0142. Your number is #14, and the doctor should see you around 19:10.": "ඔබේ යොමු අංකය MC-20261109-0142 ය. ඔබේ අංකය #14 වන අතර වෛද්‍යවරයා ඔබව බලන්නේ 19:10 පමණය.",
  "Welcome": "සාදරයෙන් පිළිගනිමු",
  "Lanka Care Hospital, Colombo": "ලංකා කෙයාර් රෝහල, කොළඹ",
  "Your doctor, one tap away": "ඔබේ වෛද්‍යවරයා, එක ස්පර්ශයකින්",
  "Book a visit, follow your number live, or chat with your doctor online. No more waiting on the phone or in long queues.": "වෙන්කිරීමක් කරන්න, ඔබේ අංකය සජීවීව බලන්න, නැතහොත් වෛද්‍යවරයා සමඟ මාර්ගගතව කතා කරන්න. දුරකථනයේ හෝ දිගු පෝලිම්වල බලා සිටීම අවසන්.",
  "New here?": "මෙහි අලුත්ද?",
  "Book in minutes": "මිනිත්තු කිහිපයකින් වෙන්කරන්න",
  "Pick a doctor, choose a time and get your number straight away.": "වෛද්‍යවරයෙකු සහ වේලාවක් තෝරා ඔබේ අංකය වහාම ලබාගන්න.",
  "Follow your queue": "ඔබේ පෝලිම බලන්න",
  "See who is being served now and get a nudge when your turn is near.": "දැන් අමතන්නේ කාවදැයි බලන්න; ඔබේ වාරය ළඟා වූ විට දැනුම්දීමක් ලබාගන්න.",
  "Safe and private": "ආරක්ෂිත සහ පෞද්ගලිකයි",
  "Your health details are encrypted and only you and your doctor can read them.": "ඔබේ සෞඛ්‍ය තොරතුරු සංකේතනය කර ඇති අතර කියවිය හැක්කේ ඔබට සහ ඔබේ වෛද්‍යවරයාට පමණි.",
  "Find doctors": "වෛද්‍යවරුන් සොයන්න",
  "My appointments": "මගේ වෙන්කිරීම්",
  "Consultation": "වෛද්‍ය උපදේශනය",
  "Doctor": "වෛද්‍ය",
  "Manager": "කළමනාකරු",
  "Admin": "පරිපාලක",
  "Log in": "ඇතුල් වන්න",
  "Register": "ලියාපදිංචි වන්න",
  "Log out": "පිටවන්න",
  "Customer": "රෝගියා",
  "Find a doctor": "වෛද්‍යවරයෙකු සොයන්න",
  "Lanka Care Hospital, Colombo · all times Asia/Colombo": "ලංකා කෙයාර් රෝහල, කොළඹ · සියලු වේලාවන් ආසියා/කොළඹ",
  "Doctor name": "වෛද්‍යවරයාගේ නම",
  "Specialisation": "විශේෂත්වය",
  "Date": "දිනය",
  "Session type": "සැසි වර්ගය",
  "All": "සියල්ල",
  "Cardiology": "හෘද රෝග",
  "Neurology": "ස්නායු රෝග",
  "Paediatrics": "ළමා රෝග",
  "Physical": "රෝහලේදී",
  "Online": "මාර්ගගත",
  "Search sessions": "සැසි සොයන්න",
  "Availability updates when anyone books or cancels": "ඕනෑම කෙනෙක් වෙන්කළ හෝ අවලංගු කළ විට ඉතිරි ස්ථාන සජීවීව යාවත්කාලීන වේ",
  "Spots left (live)": "ඉතිරි ස්ථාන (සජීවී)",
  "Book": "වෙන්කරන්න",
  "Session full": "සැසිය පිරී ඇත",
  "No spots left": "ස්ථාන ඉතිරි නැත",
  "What would you like to see the doctor about?": "ඔබ වෛද්‍යවරයා හමුවීමට කැමති කුමක් සඳහාද?",
  "Please tell us a little about why you’re visiting.": "ඔබ පැමිණෙන්නේ ඇයිදැයි කෙටියෙන් අපට කියන්න.",
  "You’ll get your queue number as soon as you book, and it’s yours alone. Your estimated time depends on your number and any delays.": "වෙන්කළ විගස ඔබට පෝලිම් අංකයක් ලැබේ; එය ඔබට පමණක් වෙන්වේ. ඔබේ ඇස්තමේන්තු වේලාව රඳා පවතින්නේ ඔබේ අංකය සහ ප්‍රමාදයන් මතය.",
  "Confirm my booking": "මගේ වෙන්කිරීම තහවුරු කරන්න",
  "To finish booking, please log in or create a free account.": "වෙන්කිරීම අවසන් කිරීමට කරුණාකර ඇතුල් වන්න, නැතහොත් නොමිලේ ගිණුමක් සාදන්න.",
  "Upcoming and past": "ඉදිරි සහ පසුගිය",
  "Session": "සැසිය",
  "Type": "වර්ගය",
  "Status": "තත්ත්වය",
  "Payment": "ගෙවීම",
  "Booked": "වෙන්කළා",
  "Pending": "පොරොත්තුවෙන්",
  "Completed": "අවසන්",
  "Cancelled": "අවලංගුයි",
  "Cancel": "අවලංගු කරන්න",
  "Now serving": "දැන් අමතන අංකය",
  "Your number": "ඔබේ අංකය",
  "Est. time": "ඇස්තමේන්තු වේලාව",
  "Session in progress": "සැසිය පවතී",
  "Summary & feedback": "සාරාංශය සහ ප්‍රතිචාර",
  "Kept on record": "වාර්තාවේ තබා ඇත",
  "Cancel closed (BR-07)": "අවලංගු කිරීම වසා ඇත",
  "Unpaid appointments can be cancelled until 3 hours before the session. Cancelled appointments stay in your history.": "නොගෙවූ වෙන්කිරීම් සැසියට පැය 3කට පෙර දක්වා අවලංගු කළ හැක. අවලංගු කළ වෙන්කිරීම් ඔබේ ඉතිහාසයේ රැඳේ.",
  "Today’s sessions": "අද සැසි",
  "Patient list": "රෝගී ලැයිස්තුව",
  "Notes": "සටහන්",
  "Patients in this session": "මෙම සැසියේ රෝගීන්",
  "No.": "අංකය",
  "Patient": "රෝගියා",
  "Check-in": "පැමිණීම",
  "Start session": "සැසිය අරඹන්න",
  "End session": "සැසිය අවසන් කරන්න",
  "Complete": "අවසන් කරන්න",
  "No-show": "නොපැමිණියා",
  "Waiting": "බලා සිටින",
  "In consultation": "උපදේශනයේ",
  "In progress": "පවතී",
  "Arrived": "පැමිණියා",
  "Not arrived": "පැමිණ නැත",
  "Next": "ඊළඟ",
  "Diagnosis summary": "රෝග විනිශ්චය සාරාංශය",
  "Advice and prescription": "උපදෙස් සහ වට්ටෝරුව",
  "Save notes": "සටහන් සුරකින්න",
  "Reason for visit": "පැමිණීමේ හේතුව",
  "Online consultation": "මාර්ගගත උපදේශනය",
  "Private chat": "පෞද්ගලික චැට්",
  "Connected": "සම්බන්ධයි",
  "Message (max 1000 characters)": "පණිවිඩය (උපරිම අක්ෂර 1000)",
  "Send": "යවන්න",
  "End consultation": "උපදේශනය අවසන් කරන්න",
  "Doctor’s summary": "වෛද්‍යවරයාගේ සාරාංශය",
  "Consultation summary": "උපදේශන සාරාංශය",
  "Print summary & prescription": "සාරාංශය සහ වට්ටෝරුව මුද්‍රණය කරන්න",
  "Feedback": "ප්‍රතිචාර",
  "Rating (1–5)": "ශ්‍රේණිගත කිරීම (1–5)",
  "Comment": "අදහස",
  "Submit feedback": "ප්‍රතිචාර යවන්න",
  "Manager dashboard": "කළමනාකරු උපකරණ පුවරුව",
  "Dashboard": "උපකරණ පුවරුව",
  "Sessions": "සැසි",
  "Reception": "පිළිගැනීම",
  "Notices and feedback": "දැන්වීම් සහ ප්‍රතිචාර",
  "Book for walk-in patient": "පැමිණි රෝගියෙකු සඳහා වෙන්කරන්න",
  "Sessions today": "අද සැසි ගණන",
  "Appointments": "වෙන්කිරීම්",
  "Physical / online": "රෝහලේදී / මාර්ගගත",
  "No-show rate": "නොපැමිණීමේ අනුපාතය",
  "Revenue": "ආදායම",
  "Time": "වේලාව",
  "Room": "කාමරය",
  "Delay": "ප්‍රමාද කරන්න",
  "Edit": "සංස්කරණය",
  "Open": "විවෘතයි",
  "Search today’s appointments": "අද වෙන්කිරීම් සොයන්න",
  "Mark arrived": "පැමිණියා ලෙස සලකුණු කරන්න",
  "Record payment": "ගෙවීම සටහන් කරන්න",
  "Publish notice": "දැන්වීමක් පළ කරන්න",
  "Approve": "අනුමත කරන්න",
  "Hide": "සඟවන්න",
  "Show": "පෙන්වන්න",
  "System administration": "පද්ධති පරිපාලනය",
  "System dashboard": "පද්ධති උපකරණ පුවරුව",
  "Active accounts": "සක්‍රීය ගිණුම්",
  "Doctors": "වෛද්‍යවරු",
  "Managers": "කළමනාකරුවෝ",
  "Failed logins today": "අද අසාර්ථක ඇතුල්වීම්",
  "Staff accounts": "කාර්ය මණ්ඩල ගිණුම්",
  "Name": "නම",
  "Email": "විද්‍යුත් තැපෑල",
  "Role": "භූමිකාව",
  "Active": "සක්‍රීය",
  "Inactive": "අක්‍රීය",
  "Deactivate": "අක්‍රීය කරන්න",
  "Activate": "සක්‍රීය කරන්න",
  "Reset password": "මුරපදය යළි පිහිටුවන්න",
  "Create staff account": "කාර්ය මණ්ඩල ගිණුමක් සාදන්න",
  "Full name": "සම්පූර්ණ නම",
  "Create account": "ගිණුම සාදන්න",
  "A temporary password is issued and must be changed at first login.": "තාවකාලික මුරපදයක් ලැබේ; පළමු ඇතුල්වීමේදී එය වෙනස් කළ යුතුය.",
  "Audit log": "විගණන සටහන",
  "Action": "ක්‍රියාව",
  "User": "පරිශීලක",
  "IP": "IP",
  "Welcome back": "නැවත සාදරයෙන් පිළිගනිමු",
  "Log in to book and manage your appointments.": "වෙන්කිරීම් කිරීමට සහ කළමනාකරණයට ඇතුල් වන්න.",
  "Password": "මුරපදය",
  "New patient?": "අලුත් රෝගියෙක්ද?",
  "Create an account": "ගිණුමක් සාදන්න",
  "Doctor and manager accounts are created by the hospital IT administrator.": "වෛද්‍ය සහ කළමනාකරු ගිණුම් සාදන්නේ රෝහලේ තොරතුරු තාක්ෂණ පරිපාලකයා විසිනි.",
  "That email or password doesn’t look right. Please try again.": "එම විද්‍යුත් තැපෑල හෝ මුරපදය නිවැරදි නැත. කරුණාකර නැවත උත්සාහ කරන්න.",
  "Too many wrong attempts. For your safety, please try again in 15 minutes.": "වැරදි උත්සාහ ඉතා වැඩියි. ඔබේ ආරක්ෂාව සඳහා මිනිත්තු 15කින් නැවත උත්සාහ කරන්න.",
  "Create your account": "ඔබේ ගිණුම සාදන්න",
  "Create a free patient account to start booking.": "වෙන්කිරීම් ආරම්භ කිරීමට නොමිලේ රෝගී ගිණුමක් සාදන්න.",
  "NIC": "ජාතික හැඳුනුම්පත් අංකය",
  "Date of birth": "උපන් දිනය",
  "Gender": "ස්ත්‍රී/පුරුෂ භාවය",
  "Choose": "තෝරන්න",
  "Female": "ගැහැණු",
  "Male": "පිරිමි",
  "Other": "වෙනත්",
  "Phone": "දුරකථනය",
  "Address": "ලිපිනය",
  "Confirm password": "මුරපදය තහවුරු කරන්න",
  "Already registered?": "දැනටමත් ලියාපදිංචිද?",
  "You’re all set! Your account is ready. Please log in.": "සියල්ල සූදානම්! ඔබේ ගිණුම සාදා ඇත. කරුණාකර ඇතුල් වන්න.",
  "There’s already an account with this email or NIC. Try logging in instead.": "මෙම විද්‍යුත් තැපෑල හෝ හැඳුනුම්පත් අංකයෙන් දැනටමත් ගිණුමක් ඇත. ඒ වෙනුවට ඇතුල් වීමට උත්සාහ කරන්න.",
  "We couldn’t create your account just now. Please check your details and try again.": "ඔබේ ගිණුම දැන් සෑදීමට නොහැකි විය. විස්තර පරීක්ෂා කර නැවත උත්සාහ කරන්න.",
  "Please enter your full name.": "කරුණාකර ඔබේ සම්පූර්ණ නම ඇතුල් කරන්න.",
  "That NIC doesn’t look right. Use 9 digits + V/X, or 12 digits.": "එම හැඳුනුම්පත් අංකය නිවැරදි නැත. ඉලක්කම් 9 + V/X, හෝ ඉලක්කම් 12 භාවිතා කරන්න.",
  "Please choose your date of birth.": "කරුණාකර ඔබේ උපන් දිනය තෝරන්න.",
  "Please enter your phone number like 07XXXXXXXX.": "කරුණාකර දුරකථන අංකය 07XXXXXXXX ආකාරයට ඇතුල් කරන්න.",
  "Please enter a valid email address.": "කරුණාකර වලංගු විද්‍යුත් තැපැල් ලිපිනයක් ඇතුල් කරන්න.",
  "Please enter your address.": "කරුණාකර ඔබේ ලිපිනය ඇතුල් කරන්න.",
  "Use at least 8 characters, with a letter, a number and a symbol.": "අවම අක්ෂර 8ක්, අකුරක්, ඉලක්කමක් සහ සංකේතයක් සමඟ භාවිතා කරන්න.",
  "The passwords don’t match yet.": "මුරපද තවම ගැළපෙන්නේ නැත.",
  "Please fill this in.": "කරුණාකර මෙය පුරවන්න.",
  "Skip the phone queue.": "දුරකථන පෝලිම මඟහරින්න.",
  "Book a doctor, follow your number live and consult online, all in one place at Lanka Care Hospital.": "ලංකා කෙයාර් රෝහලේදී වෛද්‍යවරයෙකු වෙන්කරන්න, ඔබේ අංකය සජීවීව බලන්න, මාර්ගගතව උපදෙස් ගන්න — සියල්ල එක තැනකින්.",
  "Passwords are hashed with bcrypt, never stored in plain text.": "මුරපද bcrypt මගින් සුරක්ෂිත කෙරේ; සරල අකුරින් කිසිවිට ගබඩා නොකරයි.",
  "Personal and medical data is encrypted with AES-256-GCM.": "පෞද්ගලික සහ වෛද්‍ය දත්ත AES-256-GCM මගින් සංකේතනය කෙරේ.",
  "Sessions use signed tokens in HTTP-only, Secure cookies.": "ඇතුල්වීම් සැසි HTTP-only, Secure කුකී තුළ අත්සන් කළ ටෝකන් භාවිතා කරයි.",
  "Emergency? Call 1990": "හදිසි අවස්ථාවක්ද? 1990 අමතන්න",
  "Patients": "රෝගීන්",
  "Hospital staff": "රෝහල් කාර්ය මණ්ඩලය",
  "Doctor console": "වෛද්‍ය කොන්සෝලය",
  "Administration": "පරිපාලනය",
  "Book a doctor, follow your queue live and consult online, all in one place at Lanka Care Hospital, Colombo.": "ලංකා කෙයාර් රෝහලේදී (කොළඹ) වෛද්‍යවරයෙකු වෙන්කරන්න, ඔබේ පෝලිම සජීවීව බලන්න, මාර්ගගතව උපදෙස් ගන්න — සියල්ල එක තැනකින්.",
  "Medical data is encrypted and visible only to you and your doctor.": "වෛද්‍ය දත්ත සංකේතනය කර ඇති අතර ඒවා පෙනෙන්නේ ඔබට සහ ඔබේ වෛද්‍යවරයාට පමණි.",
  "Book: Dr. Nadeesha Wijesinghe": "වෙන්කරන්න: Dr. Nadeesha Wijesinghe",
  "Reference or name": "යොමුව හෝ නම",
  "e.g. Wijesinghe": "උදා: Wijesinghe",
  "Booking closes 16:00 (1 h before)": "වෙන්කිරීම් වසන වේලාව 16:00 (පැය 1කට පෙර)",
  "Booking closes 18:00 (30 min before)": "වෙන්කිරීම් වසන වේලාව 18:00 (මිනිත්තු 30කට පෙර)",
  "Video-free chat room": "වීඩියෝ රහිත චැට් කාමරය"
};

  const L = (value) => (lang === "si" && D[value]) || value;

  function tx(node) {
    const text = node.data.trim();
    if (!text) return;

    let english = node.__en;

    if (
      english === undefined ||
      (text !== english.trim() && text !== node.__si)
    ) {
      english = node.__en = node.data;
    }

    const translated = lang === "si" && D[english.trim()];
    node.__si = translated || undefined;

    const next = translated
      ? english.replace(english.trim(), translated)
      : english;

    if (node.data !== next) node.data = next;
  }

  function attributeTranslate(element) {
    ["placeholder", "aria-label", "data-label"].forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return;

      const key = "_" + attribute;
      const current = element.getAttribute(attribute);

      if (
        element[key] === undefined ||
        (current !== element[key] && current !== element[key + "s"])
      ) {
        element[key] = current;
      }

      const translated = lang === "si" && D[element[key]];
      element[key + "s"] = translated || undefined;

      const next = translated || element[key];

      if (current !== next) element.setAttribute(attribute, next);
    });
  }

  function applyLocalisation(root) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) =>
          /^(SCRIPT|STYLE)$/.test(node.parentNode.nodeName)
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT,
      }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(tx);

    root
      .querySelectorAll("[placeholder],[aria-label],[data-label]")
      .forEach(attributeTranslate);
  }

  languageButton = document.createElement("button");
  languageButton.id = "lang-btn";
  languageButton.type = "button";
  languageButton.className =
    "fixed bottom-4 right-4 z-50 px-4 py-2 rounded-full bg-white border border-line shadow-lg text-sm font-semibold text-brand cursor-pointer hover:bg-snow";
  document.body.appendChild(languageButton);

  function setLang(next) {
    lang = next;

    try {
      localStorage.setItem("mc-lang", next);
    } catch {
      // Ignore.
    }

    document.documentElement.lang = next === "si" ? "si" : "en";
    languageButton.textContent = next === "si" ? "English" : "සිංහල";
    languageButton.setAttribute(
      "aria-label",
      next === "si" ? "Switch to English" : "සිංහලට මාරු වන්න"
    );

    applyLocalisation(document.body);

    document
      .querySelectorAll('[data-v][aria-invalid="true"]')
      .forEach(chk);

    const visibleView = views.find((view) => !view.hidden);
    if (visibleView) {
      document.title = L(visibleView.dataset.title) + " · MediChannel";
    }
  }

  languageButton.addEventListener("click", () => {
    setLang(lang === "si" ? "en" : "si");
  });

  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "characterData") {
        tx(mutation.target);
        return;
      }

      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 3) tx(node);
        else if (node.nodeType === 1) applyLocalisation(node);
      });
    });
  }).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  setLang(lang);

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------

  async function initializeApp() {
    let unavailable = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await MC.me();

        if (!result) {
          S = null;
          break;
        }

        if (result.user) {
          setSession(result.user);
          break;
        }

        unavailable = true;
      } catch {
        unavailable = true;
      }

      if (attempt < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, attempt === 0 ? 1000 : 3000)
        );
      }
    }

    if (bootTimer) {
      clearTimeout(bootTimer);
      bootTimer = null;
    }

    document.body.dataset.appReady = "true";

    if (unavailable && !S) {
      setAppMessage(
        "We could not verify your session. Please sign in again or retry."
      );
    }

    render();

    const target = resolveView(parseHash());
    showView(target.id, target.panel, { force: true });

    if (target.consultId) {
      state.consult.requestedId = target.consultId;
      if (activeView === "consult") void loadConsultationPicker();
    }
  }

  bootTimer = setTimeout(() => {
    if (document.body.dataset.appReady === "true") return;

    bootTimer = null;
    document.body.dataset.appReady = "true";
    setAppMessage(
      "The session check is taking longer than expected. Please sign in again if needed."
    );
    render();
    const target = resolveView(parseHash());
    showView(target.id, target.panel, { force: true });
  }, 15000);

  void wakeBackend();
  void initializeApp();
})();
