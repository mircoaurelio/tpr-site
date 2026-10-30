/* Native interactions shared by the Versione Aggiornata preview. */
(() => {
  "use strict";
  const base = new URL(".", document.currentScript.src);
  const menu = document.querySelector(".preview-menu");
  const menuOpen = document.querySelector("[data-menu-open]");
  const main = document.querySelector("main");
  const header = document.querySelector(".preview-header");
  const footer = document.querySelector(".preview-footer");
  let previousFocus;
  const focusable = (element) =>
    [
      ...element.querySelectorAll(
        'a[href],button:not(:disabled),input:not(:disabled),select,textarea,[tabindex="0"]',
      ),
    ].filter(
      (node) => node.getClientRects().length && !node.closest("[inert]"),
    );
  const toggleMenu = (open) => {
    if (!menu) return;
    if (open) previousFocus = document.activeElement;
    menu.inert = !open;
    menu.setAttribute("aria-hidden", String(!open));
    menu.classList.toggle("is-open", open);
    menuOpen.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("is-menu-open", open);
    for (const region of [main, header, footer])
      if (region) region.inert = open;
    if (open) menu.querySelector("[data-menu-close]").focus();
    else previousFocus?.focus();
  };
  menuOpen?.addEventListener("click", () => toggleMenu(true));
  menu
    ?.querySelector("[data-menu-close]")
    .addEventListener("click", () => toggleMenu(false));
  menu?.addEventListener("click", (event) => {
    if (event.target.closest("a")) toggleMenu(false);
  });
  menu?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      toggleMenu(false);
    }
    if (event.key !== "Tab") return;
    const nodes = focusable(menu);
    if (event.shiftKey && document.activeElement === nodes[0]) {
      event.preventDefault();
      nodes.at(-1)?.focus();
    } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) {
      event.preventDefault();
      nodes[0]?.focus();
    }
  });

  // The static preview hands enquiries to the visitor's email application.
  // It never reports that a message was sent by a nonexistent form backend.
  document.querySelectorAll("[data-inquiry-form]").forEach((form) => {
    const submit = form.querySelector("[type=submit]");
    const status = form.querySelector("[role=status]");
    const update = () =>
      submit.classList.toggle("is-ready", form.checkValidity());
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const values = new FormData(form);
      const context = new URLSearchParams(location.search);
      const body = [
        `Tipologia: ${values.get("user_type")}`,
        `Nome: ${values.get("name")}`,
        `Email: ${values.get("email")}`,
        `Telefono: ${values.get("phone")}`,
        ...(context.get("offer") ? [`Offerta: ${context.get("offer")}`] : []),
        ...(context.get("room") ? [`Stanza: ${context.get("room")}`] : []),
        "",
        values.get("message") || "",
      ].join("\n");
      const url = `mailto:hello@thepeoplesroom.it?subject=${encodeURIComponent(form.dataset.subject)}&body=${encodeURIComponent(body)}`;
      const emailLink = document.createElement("a");
      emailLink.href = url;
      emailLink.textContent =
        "Apri il messaggio nella tua app email per inviarlo.";
      status.replaceChildren(emailLink);
      form.closest(".preview-contact-card")?.classList.add("has-status");
      emailLink.click();
    });
    update();
  });

  document.querySelectorAll("[data-newsletter-form]").forEach((form) => {
    const email = form.elements.email;
    const consent = form.elements.consent;
    const button = form.querySelector("[type=submit]");
    const status = form.querySelector("[role=status]");
    const originalText = button.textContent;
    let busy = false;
    const update = () => {
      const ready =
        email.validity.valid && email.value.trim() !== "" && consent.checked;
      button.disabled = busy || !ready;
      button.classList.toggle("is-ready", ready);
    };
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (busy || !form.reportValidity()) return;
      busy = true;
      form.setAttribute("aria-busy", "true");
      button.textContent = "Invio…";
      status.textContent = "";
      update();
      try {
        const response = await fetch(form.dataset.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.value.trim(),
            consent: consent.checked,
            website: form.elements.website.value,
          }),
          signal: AbortSignal.timeout(15000),
          credentials: "omit",
        });
        const result = await response.json();
        if (!response.ok || result.success !== true)
          throw new Error("Subscription failed");
        status.textContent = "Grazie! Sei nella community TPR. A presto.";
        form.reset();
      } catch {
        status.textContent = "Iscrizione non riuscita. Riprova tra poco.";
      } finally {
        busy = false;
        form.removeAttribute("aria-busy");
        button.textContent = originalText;
        update();
      }
    });
    update();
  });

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("[data-carousel]").forEach((carousel) => {
    const initial = carousel.dataset.initialScroll;
    if (initial) {
      let used = false;
      for (const event of ["pointerdown", "wheel", "keydown"])
        carousel.addEventListener(
          event,
          () => {
            used = true;
          },
          { once: true, passive: true },
        );
      Promise.all([
        document.fonts?.ready,
        ...[...carousel.querySelectorAll("img")].map((image) =>
          image.decode().catch(() => {}),
        ),
      ]).then(() =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (used || !matchMedia("(min-width: 901px)").matches) return;
            carousel.style.scrollSnapType = "none";
            const maximum = carousel.scrollWidth - carousel.clientWidth;
            carousel.scrollLeft = initial === "end" ? maximum : maximum / 2;
          }),
        ),
      );
    }
    carousel.addEventListener("keydown", (event) => {
      if (
        event.target !== carousel ||
        !["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)
      )
        return;
      event.preventDefault();
      const distance =
        (carousel.firstElementChild?.getBoundingClientRect().width || 320) +
        parseFloat(getComputedStyle(carousel).gap || 0);
      const left =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? carousel.scrollWidth
            : carousel.scrollLeft +
              (event.key === "ArrowRight" ? distance : -distance);
      carousel.scrollTo({
        left,
        behavior: reducedMotion ? "instant" : "smooth",
      });
    });
  });

  document.querySelectorAll("[data-room-explorer]").forEach((explorer) => {
    const panels = [...explorer.querySelectorAll("[data-room-panel]")];
    const nav = [...explorer.querySelectorAll("[data-room-select]")];
    const syncColors = (panel) => {
      for (const property of ["--room-bg", "--room-accent"])
        explorer.style.setProperty(
          property,
          panel.style.getPropertyValue(property),
        );
    };
    const setExplore = (panel, open) => {
      const details = panel.querySelector(".preview-room-details");
      const copy = panel.querySelector(".preview-room-copy");
      panel.classList.toggle("is-exploring", open);
      details.inert = !open;
      details.setAttribute("aria-hidden", String(!open));
      copy.inert = open;
      const roomNav = explorer.querySelector(".preview-room-nav");
      if (roomNav) roomNav.inert = open;
      panel
        .querySelector("[data-room-explore]")
        .setAttribute("aria-expanded", String(open));
      (open
        ? panel.querySelector("[data-room-back]")
        : panel.querySelector("[data-room-explore]")
      ).focus({ preventScroll: true });
    };
    nav.forEach((button) =>
      button.addEventListener("click", () => {
        explorer.querySelector(".preview-room-nav").inert = false;
        for (const panel of panels) {
          const active = panel.dataset.roomPanel === button.dataset.roomSelect;
          panel.hidden = !active;
          if (active) syncColors(panel);
          else {
            panel.classList.remove("is-exploring");
            panel.querySelector(".preview-room-details").inert = true;
            panel
              .querySelector(".preview-room-details")
              .setAttribute("aria-hidden", "true");
            panel.querySelector(".preview-room-copy").inert = false;
            panel
              .querySelector("[data-room-explore]")
              .setAttribute("aria-expanded", "false");
          }
        }
        nav.forEach((item) =>
          item.setAttribute("aria-pressed", String(item === button)),
        );
      }),
    );
    const nextRoom = explorer.querySelector("[data-room-next]");
    nextRoom?.addEventListener("click", () => {
      const current = nav.findIndex(
        (button) => button.getAttribute("aria-pressed") === "true",
      );
      nav[(current + 1) % nav.length]?.click();
    });
    panels.forEach((panel) => {
      panel
        .querySelector("[data-room-explore]")
        .addEventListener("click", () => setExplore(panel, true));
      panel
        .querySelector("[data-room-back]")
        .addEventListener("click", () => setExplore(panel, false));
      panel.addEventListener("keydown", (event) => {
        if (
          event.key === "Escape" &&
          panel.classList.contains("is-exploring")
        ) {
          event.preventDefault();
          setExplore(panel, false);
        }
      });
    });
    syncColors(panels[0]);
  });

  document.querySelectorAll("[data-room-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const button = document.querySelector(
        `[data-room-select="${link.dataset.roomLink}"]`,
      );
      if (!button) return;
      event.preventDefault();
      button.click();
      document.querySelector("[data-room-explorer]").scrollIntoView({
        behavior: reducedMotion ? "instant" : "smooth",
        block: "start",
      });
      button.focus({ preventScroll: true });
    });
  });

  const discover = document.querySelector(".preview-discover");
  if (discover) {
    const content = discover.querySelector(".preview-discover-content");
    const original = content.innerHTML;
    const roomData = fetch(new URL("design/updated-content.json", base))
      .then((response) => {
        if (!response.ok) throw new Error("Content unavailable");
        return response.json();
      })
      .catch(() => null);
    let selected = null;
    let request = 0;
    discover.querySelectorAll("[data-discover]").forEach((button) =>
      button.addEventListener("click", async () => {
        const sequence = ++request;
        const data = await roomData;
        if (sequence !== request) return;
        const key =
          selected === button.dataset.discover ? null : button.dataset.discover;
        if (!key || !data) {
          selected = null;
          content.innerHTML = original;
          content.classList.remove("is-detail");
        } else {
          selected = key;
          const title = document.createElement("h2");
          title.className = "sr-only";
          title.textContent =
            key === "community" ? "Community" : data.rooms[key].title;
          const character = document.createElement("img");
          character.className = "preview-discover-character";
          character.src = new URL(
            key === "reformer"
              ? "assets/figma-updated/shapes/about-selected-move-character.svg"
              : `assets/little-man/${key === "community" ? "coworking" : key}.svg`,
            base,
          ).href;
          character.alt = "";
          character.setAttribute("aria-hidden", "true");
          const copy = document.createElement("p");
          const paragraphs =
            data.about.discovery?.[key]?.paragraphs ||
            (key === "community"
              ? [data.newsletter.description]
              : data.rooms[key].paragraphs);
          copy.className = "preview-discover-copy";
          for (const text of paragraphs) {
            const paragraph = document.createElement("span");
            paragraph.className = "preview-discover-paragraph";
            paragraph.textContent = text;
            copy.append(paragraph);
          }
          const link = document.createElement("a");
          link.className = "preview-button preview-button--pink";
          link.href = new URL(
            key === "community" ? "homepage-tpr/#community" : `rooms/${key}/`,
            base,
          ).href;
          link.textContent = "Esplora Stanza";
          const arrow = document.createElement("span");
          arrow.className = "preview-chevron";
          arrow.setAttribute("aria-hidden", "true");
          link.append(arrow);
          content.replaceChildren(title, character, copy, link);
          content.dataset.selectedKey = key;
          content.classList.add("is-detail");
        }
        discover
          .querySelectorAll("[data-discover]")
          .forEach((item) =>
            item.setAttribute(
              "aria-pressed",
              String(item.dataset.discover === selected),
            ),
          );
      }),
    );
  }
})();
