(function () {
  var buttons = Array.prototype.slice.call(document.querySelectorAll(".action"));
  var statusText = document.getElementById("statusText");
  var previewFrame = document.getElementById("previewFrame");
  var hero = document.querySelector(".hero");
  var controls = document.querySelector(".controls");
  var signatureCard = document.querySelector(".signature-card");
  var focusedIndex = 0;
  var idleTimer = null;
  var autoCycleTimer = null;
  var idleDelay = 9000;
  var cycleDelay = 20000;
  var modeOrder = ["solar", "space", "signature"];
  var currentMode = 0;

  function setFocused(index) {
    focusedIndex = (index + buttons.length) % buttons.length;
    buttons.forEach(function (button, currentIndex) {
      button.classList.toggle("is-focused", currentIndex === focusedIndex);
    });
    buttons[focusedIndex].focus();
  }

  function updateStatus(message) {
    if (statusText) statusText.textContent = message;
  }

  function setIdleUi(hidden) {
    if (hero) hero.classList.toggle("is-idle", hidden);
    if (controls) controls.style.opacity = hidden ? "0" : "1";
    if (signatureCard) signatureCard.style.opacity = hidden ? "0" : "1";
  }

  function clearCycle() {
    if (idleTimer) {
      window.clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (autoCycleTimer) {
      window.clearInterval(autoCycleTimer);
      autoCycleTimer = null;
    }
  }

  function activateMode(action, fromAutoCycle) {
    previewFrame.classList.remove("is-solar", "is-space", "is-signature");

    if (action === "solar") {
      previewFrame.classList.add("is-solar");
      updateStatus(fromAutoCycle ? "Auto cycle: solar system mode." : "Solar system mode selected. This is the calm watch face for the Universe Engine.");
      currentMode = 0;
      return;
    }

    if (action === "space") {
      previewFrame.classList.add("is-space");
      updateStatus(fromAutoCycle ? "Auto cycle: known space drift." : "Known space selected. The app should drift slowly through the wider sky.");
      currentMode = 1;
      return;
    }

    if (action === "signature") {
      previewFrame.classList.add("is-signature");
      if (signatureCard) {
        signatureCard.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
      updateStatus(fromAutoCycle ? "Auto cycle: signature screen." : "Signature screen selected. This is the branded end-card for the TV app.");
      currentMode = 2;
    }
  }

  function startIdleCycle() {
    clearCycle();
    setIdleUi(false);
    idleTimer = window.setTimeout(function () {
      setIdleUi(true);
      autoCycleTimer = window.setInterval(function () {
        currentMode = (currentMode + 1) % modeOrder.length;
        activateMode(modeOrder[currentMode], true);
      }, cycleDelay);
    }, idleDelay);
  }

  function handleActivate(action) {
    clearCycle();
    activateMode(action, false);
    startIdleCycle();
  }

  buttons.forEach(function (button, index) {
    button.addEventListener("click", function () {
      handleActivate(button.getAttribute("data-action"));
    });

    button.addEventListener("focus", function () {
      setFocused(index);
    });
  });

  window.addEventListener("pointermove", startIdleCycle, { passive: true });
  window.addEventListener("mousemove", startIdleCycle, { passive: true });
  window.addEventListener("touchstart", startIdleCycle, { passive: true });

  window.addEventListener("keydown", function (event) {
    if (!buttons.length) return;

    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      setFocused(focusedIndex + 1);
    }

    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      setFocused(focusedIndex - 1);
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      buttons[focusedIndex].click();
    }

    if (event.key === "Escape" || event.key === "Backspace") {
      updateStatus("Back action received. Hook this to home navigation in the packaged app.");
    }

    startIdleCycle();
  });

  setFocused(0);
  activateMode("solar", true);
  startIdleCycle();
})();