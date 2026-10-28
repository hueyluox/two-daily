(function () {
  const KEY = "two-daily-v1";
  const MEALS = ["breakfast", "lunch", "dinner"];
  const MEAL_NAME = { breakfast: "早餐", lunch: "午餐", dinner: "晚饭" };

  const main = document.getElementById("main");
  const top = document.getElementById("top");
  let pendingImport = null;
  let importError = "";

  function blank() {
    return { v: 1, person: "me", meals: { me: {}, her: {} }, move: { me: {}, her: {} }, feel: { me: {}, her: {} }, hideNote: false };
  }

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || "");
      if (!data || data.v !== 1 || !data.meals || !data.move || !data.feel) return blank();
      data.person = data.person === "her" ? "her" : "me";
      return data;
    } catch (e) {
      return blank();
    }
  }

  let state = load();

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function todayISO() {
    return iso(new Date());
  }

  function zhDate(value) {
    const parts = value.split("-").map(Number);
    return parts[1] + "月" + parts[2] + "日";
  }

  function dayBy(value) {
    return PLAN.days.find((day) => day.date === value) || null;
  }

  function route() {
    const parts = (location.hash || "#today").slice(1).split("/");
    const name = ["today", "menu", "move", "week"].includes(parts[0]) ? parts[0] : "today";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(parts[1] || "") ? parts[1] : todayISO();
    return { name, date };
  }

  function viewDate() {
    const here = route();
    if (here.name === "menu" || here.name === "week") return todayISO();
    return dayBy(here.date) ? here.date : todayISO();
  }

  function person() {
    return state.person === "her" ? "her" : "me";
  }

  function mealOf(day, name) {
    return day[name][person()];
  }

  function markMeal(date, name) {
    return (state.meals[person()][date] || {})[name] || "";
  }

  function markMove(date) {
    return state.move[person()][date] || "";
  }

  function markFeel(date) {
    return state.feel[person()][date] || "";
  }

  function setMeal(date, name, value) {
    const bag = state.meals[person()];
    bag[date] = bag[date] || {};
    if (value) bag[date][name] = value;
    else delete bag[date][name];
    save();
    render(true);
  }

  function setMove(date, value) {
    const bag = state.move[person()];
    if (value) bag[date] = value;
    else delete bag[date];
    save();
    render(true);
  }

  function setFeel(date, value) {
    const bag = state.feel[person()];
    if (value) bag[date] = value;
    else delete bag[date];
    save();
    render(true);
  }

  function el(tag, attrs, kids) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "onclick") node.addEventListener("click", value);
      else if (key === "onchange") node.addEventListener("change", value);
      else node.setAttribute(key, value);
    });
    (kids || []).forEach((kid) => {
      if (kid == null || kid === false) return;
      node.append(kid.nodeType ? kid : document.createTextNode(kid));
    });
    return node;
  }

  function canMarkMeal(meal, date) {
    if (date > todayISO()) return false;
    if (date < todayISO()) return true;
    const hour = new Date().getHours();
    if (hour >= 16) return true;
    if (hour >= 10) return meal !== "dinner";
    return meal === "breakfast";
  }

  function pickLead(day) {
    const date = day.date;
    const marks = {
      breakfast: markMeal(date, "breakfast"),
      lunch: markMeal(date, "lunch"),
      dinner: markMeal(date, "dinner"),
    };
    let start = 0;
    if (date === todayISO()) {
      const hour = new Date().getHours();
      start = hour >= 16 ? 2 : hour >= 10 ? 1 : 0;
    } else if (date > todayISO()) {
      return { type: "read", meal: "dinner" };
    }
    for (let i = start; i < MEALS.length; i += 1) {
      const meal = MEALS[i];
      if (canMarkMeal(meal, date) && !marks[meal]) return { type: "meal", meal };
    }
    if (!markMove(date)) return { type: "move" };
    return { type: "settle" };
  }

  function mealButtons(date, meal, mode, big) {
    const current = markMeal(date, meal);
    if (mode === "unknown") {
      const on = current === "done";
      return el("div", { class: "actions" }, [
        el("button", {
          type: "button",
          class: on || big ? "solid" : "quiet",
          "aria-pressed": on ? "true" : "false",
          onclick: () => setMeal(date, meal, on ? "" : "done"),
        }, [on ? "吃过了" : "吃过了就点这里"]),
      ]);
    }
    const doneLabel = mode === "confirm" ? ["对，就是这顿", "已确认"] : ["照做了", "记好了"];
    const changedLabel = mode === "confirm" ? ["不是这顿", "已改过"] : ["这顿改了", "已改过"];
    const doneOn = current === "done";
    const changedOn = current === "changed";
    return el("div", { class: "actions two" }, [
      el("button", {
        type: "button",
        class: doneOn || (big && !changedOn) ? "solid" : "quiet",
        "aria-pressed": doneOn ? "true" : "false",
        onclick: () => setMeal(date, meal, doneOn ? "" : "done"),
      }, [doneOn ? doneLabel[1] : doneLabel[0]]),
      el("button", {
        type: "button",
        class: changedOn ? "solid" : "quiet",
        "aria-pressed": changedOn ? "true" : "false",
        onclick: () => setMeal(date, meal, changedOn ? "" : "changed"),
      }, [changedOn ? changedLabel[1] : changedLabel[0]]),
    ]);
  }

  function steps(meal, id) {
    if (!meal.steps || !meal.steps.length) return null;
    const list = el("ol", {}, meal.steps.map((step) => el("li", {}, [step])));
    return el("details", { id }, [el("summary", {}, ["看看做法"]), list]);
  }

  function splitFirst(text) {
    const cut = text.indexOf("。");
    if (cut < 0 || cut >= text.length - 1) return { title: text, rest: "" };
    return { title: text.slice(0, cut + 1), rest: text.slice(cut + 1) };
  }

  function mealBlock(day, name, big) {
    const meal = mealOf(day, name);
    const kids = [];
    const spoken = splitFirst(meal.text);
    if (big) kids.push(el("h2", {}, [spoken.title]));
    else {
      const later = day.date === todayISO() && !canMarkMeal(name, day.date);
      kids.push(el("p", { class: "line" }, [
        spoken.title,
        later ? el("span", { class: "later" }, ["还没到这顿"]) : null,
      ]));
    }
    if (spoken.rest) kids.push(el("p", { class: "note" }, [spoken.rest]));
    if (name === "dinner" && day.dinnerNote) kids.push(el("p", { class: "note" }, [day.dinnerNote]));
    if (meal.warn) kids.push(el("p", { class: "note" }, [meal.warn]));
    const detail = steps(meal, "steps-" + day.date + "-" + name);
    if (detail && (big || name === "dinner")) kids.push(detail);
    if (canMarkMeal(name, day.date)) kids.push(mealButtons(day.date, name, meal.mode, big));
    return el("section", { class: big ? "lead" : "row" }, kids);
  }

  function moveButtons(day, big) {
    const current = markMove(day.date);
    const kind = day.move[person()].kind;
    let choices = [["done", "做完了"], ["part", "做了些"], ["rest", "今天休息"]];
    if (kind === "rest") choices = [["rest", "今天休息"], ["done", "随便走了走"]];
    if (kind === "easy") choices = [["done", "走动了"], ["rest", "今天休息"]];
    return el("div", { class: "actions" }, choices.map(([value, label]) => {
      const on = current === value;
      const primary = big && !current && (value === "done" || (kind === "rest" && value === "rest"));
      return el("button", {
        type: "button",
        class: on || primary ? "solid" : "quiet",
        "aria-pressed": on ? "true" : "false",
        onclick: () => setMove(day.date, on ? "" : value),
      }, [label]);
    }));
  }

  function moveBlock(day, big) {
    const move = day.move[person()];
    const spoken = splitFirst(move.text);
    const kids = [big ? el("h2", {}, [spoken.title]) : el("p", { class: "line" }, [spoken.title])];
    if (big && spoken.rest) kids.push(el("p", { class: "note" }, [spoken.rest]));
    if (big && move.detail) kids.push(el("p", { class: "note" }, [move.detail]));
    if (day.date <= todayISO()) kids.push(moveButtons(day, big));
    return el("section", { class: big ? "lead" : "row" }, kids);
  }

  function feelButtons(date) {
    const current = markFeel(date);
    const choices = [["ok", "不错"], ["mid", "一般"], ["low", "困"]];
    return el("div", { class: "actions" }, choices.map(([value, label]) => {
      const on = current === value;
      return el("button", {
        type: "button",
        class: on ? "solid" : "quiet",
        "aria-pressed": on ? "true" : "false",
        onclick: () => setFeel(date, on ? "" : value),
      }, [label]);
    }));
  }

  function sleepBlock(day, big) {
    const kids = [big ? el("h2", {}, [day.sleep]) : el("p", { class: "line" }, [day.sleep])];
    kids.push(el("details", { id: "sleep-why-" + day.date }, [
      el("summary", {}, ["这个点怎么来的"]),
      el("p", { class: "note" }, [PLAN.sleepNote]),
    ]));
    if (day.date <= todayISO()) {
      kids.push(el("p", { class: "note" }, ["昨晚睡得怎样，想记就点。不点也行。"]));
      kids.push(feelButtons(day.date));
    }
    return el("section", { class: big ? "lead" : "row" }, kids);
  }

  function settleBlock(day) {
    return el("section", { class: "lead" }, [
      el("h2", {}, ["今天要点的都点过了。"]),
      el("p", { class: "note" }, [day.sleep + "漏了也不用补。"]),
    ]);
  }

  function renderToday(day) {
    const lead = pickLead(day);
    const blocks = [];
    if (day.date !== todayISO()) {
      const word = day.date > todayISO() ? "还没到这一天。" : "这天已经过去了。";
      blocks.push(el("div", { class: "banner" }, [
        el("p", {}, [zhDate(day.date) + "，" + word]),
        el("button", { type: "button", class: "texty", onclick: () => { location.hash = "#today"; } }, ["回到今天"]),
      ]));
    }
    const leadMeal = lead.type === "meal" ? lead.meal : lead.type === "read" ? "dinner" : "";
    if (leadMeal) blocks.push(mealBlock(day, leadMeal, true));
    else if (lead.type === "move") blocks.push(moveBlock(day, true));
    else blocks.push(settleBlock(day));

    const rest = [];
    MEALS.forEach((name) => {
      if (name !== leadMeal) rest.push(mealBlock(day, name, false));
    });
    if (lead.type !== "move") rest.push(moveBlock(day, false));
    if (lead.type !== "settle") rest.push(sleepBlock(day, false));

    if (day.tonight && day.tonight.length) {
      rest.push(el("section", { class: "row" }, [
        el("p", { class: "line" }, ["睡前顺手：" + day.tonight.join("")]),
      ]));
    }
    const index = PLAN.days.findIndex((item) => item.date === day.date);
    const next = PLAN.days[index + 1];
    if (next) {
      rest.push(el("section", { class: "row" }, [
        el("a", { class: "daylink", href: "#today/" + next.date }, [
          "明天早餐",
          el("span", {}, [next.breakfast[person()].short]),
        ]),
      ]));
    }
    if (day.date === PLAN.start) {
      rest.push(el("details", { id: "earlier", class: "row" }, [
        el("summary", {}, ["前两天已经说过的"]),
        el("ul", { class: "shop" }, PLAN.earlier.map((line) => el("li", {}, [line]))),
      ]));
    }
    if (!state.hideNote && day.date === todayISO()) {
      rest.push(el("section", { class: "row" }, [
        el("p", {}, ["她用自己的手机打开同一个网址，点「她」。勾选记在各自手机里，不会自动跑到对方手机上。"]),
        el("button", {
          type: "button",
          class: "quiet",
          onclick: () => { state.hideNote = true; save(); render(true); },
        }, ["知道了"]),
      ]));
    }
    blocks.push(el("div", { class: "stack" }, rest));
    blocks.push(el("p", { class: "hint" }, ["没点过不算没做。点错了再点一次就撤销。漏一天，从今天继续。"]));
    return blocks;
  }

  function exerciseList(move) {
    if (!move.exercises.length) return null;
    return el("ol", { class: "moves" }, move.exercises.map((item) => el("li", {}, [
      el("div", { class: "ex-name" }, [item.name]),
      item.how,
    ])));
  }

  function renderMove(day) {
    const move = day.move[person()];
    const spoken = splitFirst(move.text);
    const blocks = [];
    if (day.date !== todayISO()) {
      blocks.push(el("div", { class: "banner" }, [
        el("p", {}, [day.date > todayISO() ? "这是后面某一天的动作。" : "这是前面某一天的动作。"]),
        el("button", { type: "button", class: "texty", onclick: () => { location.hash = "#move"; } }, ["看今天"]),
      ]));
    }
    const leadKids = [el("h2", {}, [spoken.title])];
    if (spoken.rest) leadKids.push(el("p", { class: "note" }, [spoken.rest]));
    if (move.detail) leadKids.push(el("p", { class: "note" }, [move.detail]));
    if (day.date <= todayISO()) leadKids.push(moveButtons(day, true));
    blocks.push(el("section", { class: "lead" }, leadKids));
    const list = exerciseList(move);
    if (list) blocks.push(list);
    if (move.note) blocks.push(el("p", { class: "note" }, [move.note]));
    blocks.push(el("details", { id: "stretch" }, [
      el("summary", {}, ["做完可以拉 5 分钟"]),
      el("ol", {}, PLAN.stretch.map((line) => el("li", {}, [line]))),
    ]));
    if (move.kind === "cardio") {
      blocks.push(el("details", { id: "run-walk" }, [
        el("summary", {}, ["如果想换成跑走"]),
        el("p", { class: "note" }, ["用这一次快走换掉，不要两样叠在同一天：走 5 分钟，然后跑 1 分钟、走 1 分半，重复 8 轮，再走 5 分钟。能完整说话、第二天关节还正常，就停在这个程度。"]),
      ]));
    }
    blocks.push(el("p", { class: "hint" }, [PLAN.stop]));
    return blocks;
  }

  function renderMenu() {
    const today = todayISO();
    const week = PLAN.weeks.find((item) => today >= item.start && today <= item.end) || PLAN.weeks[0];
    const blocks = [
      el("h2", { class: "page-title" }, ["这 30 天吃什么"]),
      el("p", {}, [PLAN.bowl]),
      el("p", {}, [PLAN.eatOut]),
      el("h2", {}, ["这几天先买"]),
      el("p", { class: "note" }, [week.label + "。先看家里有的，再补缺的。"]),
      el("ul", { class: "shop stack" }, week.items.map((item) => el("li", {}, [item]))),
      el("h2", {}, ["每天"]),
    ];
    const list = el("div", { class: "stack days" }, []);
    PLAN.days.forEach((day) => {
      const who = person();
      const brief = "早 " + day.breakfast[who].short + "  ·  午 " + day.lunch[who].short + "  ·  晚 " + day.dinner[who].short;
      list.append(el("a", { class: "daylink", href: "#today/" + day.date }, [
        zhDate(day.date) + " " + day.weekday + (day.date === today ? "  今天" : ""),
        el("span", {}, [brief]),
      ]));
    });
    blocks.push(list);
    return blocks;
  }

  function mealWord(date, name) {
    const value = markMeal(date, name);
    if (!value) return MEAL_NAME[name] + "没记";
    if (value === "changed") return MEAL_NAME[name] + "改过";
    return MEAL_NAME[name] + "记了";
  }

  function renderWeek() {
    const today = todayISO();
    const who = person();
    const blocks = [
      el("h2", { class: "page-title" }, ["这台手机上的记录"]),
      el("p", {}, ["没点过不算没做，也不会扣掉什么。另一台手机要看同一份勾选，得先导出再导入。"]),
    ];
    PLAN.weeks.forEach((week, index) => {
      const days = PLAN.days.filter((day) => day.date >= week.start && day.date <= week.end);
      const items = days.map((day) => {
        let status = "还没到";
        if (day.date <= today) {
          const move = markMove(day.date);
          const moveWord = move === "done" ? "动记了" : move === "part" ? "动了些" : move === "rest" ? "这天休息" : "动没记";
          status = [mealWord(day.date, "breakfast"), mealWord(day.date, "lunch"), mealWord(day.date, "dinner"), moveWord].join(" · ");
        }
        return el("a", { class: "daylink", href: "#today/" + day.date }, [
          zhDate(day.date) + " " + day.weekday,
          el("span", {}, [status]),
        ]);
      });
      const box = el("details", { id: "week-" + index }, [el("summary", {}, [week.label]), ...items]);
      if (today >= week.start && today <= week.end) box.open = true;
      blocks.push(box);
    });
    blocks.push(el("section", { class: "row" }, [
      el("h2", {}, ["换手机之前"]),
      el("p", {}, ["用 Safari 打开这个网址，点分享，再点「添加到主屏幕」。"]),
      el("button", { type: "button", class: "solid", onclick: download }, ["导出这台手机的记录"]),
      el("label", { class: "file" }, [
        "导入另一台手机导出的文件",
        el("input", { type: "file", accept: "application/json", onchange: onFile }),
      ]),
      importError ? el("p", { class: "note" }, [importError]) : null,
      pendingBox(),
    ]));
    return blocks;
  }

  function pendingBox() {
    if (!pendingImport) return null;
    return el("div", { class: "row" }, [
      el("p", {}, ["读到一份备份。用它替换这台手机上的勾选？饮食和运动记录会被换掉。"]),
      el("div", { class: "actions two" }, [
        el("button", { type: "button", class: "solid", onclick: applyImport }, ["替换"]),
        el("button", { type: "button", class: "quiet", onclick: () => { pendingImport = null; render(true); } }, ["先不换"]),
      ]),
    ]);
  }

  function download() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "checkin-" + todayISO() + ".json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function onFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || ""));
        if (!data || data.v !== 1 || !data.meals || !data.move || !data.feel) throw new Error("bad");
        pendingImport = data;
        importError = "";
      } catch (e) {
        pendingImport = null;
        importError = "这个文件读不了。请选之前从这页导出的那一份。";
      }
      render(true);
    };
    reader.readAsText(file);
  }

  function applyImport() {
    if (!pendingImport) return;
    const keepPerson = state.person;
    state = pendingImport;
    state.person = keepPerson;
    pendingImport = null;
    importError = "";
    save();
    render(true);
  }

  function renderOutOfRange() {
    const today = todayISO();
    if (today < PLAN.start) {
      return [
        el("h2", { class: "page-title" }, ["计划从 10月28日的晚饭开始。"]),
        el("p", {}, ["现在可以先看菜单。"]),
        el("a", { class: "daylink", href: "#menu" }, ["去看菜单"]),
      ];
    }
    return [
      el("h2", { class: "page-title" }, ["这 30 天到 11月26日。"]),
      el("p", {}, ["记录还在这台手机上，换机前可以导出。"]),
      el("a", { class: "daylink", href: "#today/" + PLAN.end }, ["看最后一天"]),
    ];
  }

  function paintHeader() {
    const here = route();
    const date = here.name === "today" || here.name === "move" ? viewDate() : todayISO();
    const day = dayBy(date);
    top.replaceChildren(el("h1", {}, [
      day ? zhDate(day.date) + " " + day.weekday : "今天",
    ]));
    const who = el("div", { class: "who", role: "group", "aria-label": "谁在用" }, ["me", "her"].map((id) => el("button", {
      type: "button",
      "aria-pressed": person() === id ? "true" : "false",
      onclick: () => {
        state.person = id;
        save();
        render(true);
      },
    }, [id === "me" ? "我" : "她"])));
    top.append(who);
    document.title = day ? zhDate(day.date) + " " + day.weekday : "今天";
    document.querySelectorAll(".nav-inner button").forEach((button) => {
      const on = button.getAttribute("data-go") === here.name;
      if (on) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function render(keepScroll) {
    const y = keepScroll ? window.scrollY : 0;
    const open = new Set(Array.from(document.querySelectorAll("details[open]")).map((node) => node.id).filter(Boolean));
    if (!window.PLAN) {
      main.replaceChildren(el("p", {}, ["这页没载入计划。刷新一次。"]));
      return;
    }
    paintHeader();
    const here = route();
    let blocks = [];
    if (here.name === "menu") blocks = renderMenu();
    else if (here.name === "week") blocks = renderWeek();
    else if (here.name === "move") {
      const day = dayBy(viewDate());
      blocks = day ? renderMove(day) : renderOutOfRange();
    } else {
      const day = dayBy(viewDate());
      const today = todayISO();
      if (!day && (today < PLAN.start || today > PLAN.end) && viewDate() === today) blocks = renderOutOfRange();
      else blocks = day ? renderToday(day) : renderOutOfRange();
    }
    main.replaceChildren(el("div", {}, blocks));
    open.forEach((id) => {
      const node = document.getElementById(id);
      if (node) node.open = true;
    });
    window.scrollTo(0, y);
  }

  document.querySelectorAll(".nav-inner button").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.getAttribute("data-go");
      if (name === "move") {
        const date = viewDate();
        location.hash = date === todayISO() ? "#move" : "#move/" + date;
      } else if (name === "today") {
        location.hash = "#today";
      } else location.hash = "#" + name;
    });
  });

  window.addEventListener("hashchange", () => render(false));

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  render(false);
})();
