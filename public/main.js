const calendarElement = document.getElementById("calendar");
const yearForm = document.getElementById("yearForm");
const yearInput = document.getElementById("yearInput");
const yearError = document.getElementById("yearError");
const monthTemplate = document.getElementById("monthTemplate");
const monthModal = document.getElementById("monthModal");
const modalCalendarContainer = document.getElementById("modalCalendarContainer");
const modalCloseButton = document.getElementById("modalCloseButton");

const RENDER_MODE = {
  GRID: "grid",
  MODAL: "modal",
};

let lastFocusedMonth = null;
let latestCalendarPayload = null;

function fillWeekdayRow(row, labels) {
  row.replaceChildren();
  labels.forEach((label) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    row.appendChild(th);
  });
}

function formatCurrencyJPY(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0円";
  }
  if (value === 0) {
    return "0円";
  }
  const sign = value > 0 ? "+" : "-";
  const absolute = Math.round(Math.abs(value));
  return `${sign}${absolute.toLocaleString("ja-JP")}円`;
}

function formatJapaneseDate(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function formatPrice(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }
  return value.toLocaleString("ja-JP", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function applyTradeColor(td, summary) {
  if (!summary) {
    return;
  }
  td.classList.add("has-trade");
  if (summary.netProfit > 0) {
    td.classList.add("profit");
  } else if (summary.netProfit < 0) {
    td.classList.add("loss");
  } else {
    td.classList.add("neutral");
  }
}

function renderWeeks(tbody, weeks, options = {}) {
  const {
    mode = RENDER_MODE.GRID,
    tradeSummaries = {},
    onDaySelect,
  } = options;

  weeks.forEach((week) => {
    const tr = document.createElement("tr");
    week.forEach((day) => {
      const td = document.createElement("td");
      if (day === null) {
        td.classList.add("empty");
      } else {
        const dayNumber = document.createElement("span");
        dayNumber.className = "day-number";
        dayNumber.textContent = String(day.day);
        td.appendChild(dayNumber);

        if (day.isToday) {
          td.classList.add("today");
        }
        td.setAttribute("data-date", day.isoDate);

        const summary = tradeSummaries[day.isoDate];
        applyTradeColor(td, summary);

        if (mode === RENDER_MODE.MODAL) {
          const total = document.createElement("span");
          total.className = "day-total";
          total.textContent = summary ? formatCurrencyJPY(summary.netProfit) : "取引なし";
          td.appendChild(total);
          td.classList.add("selectable-day");
          td.tabIndex = 0;
          if (typeof onDaySelect === "function") {
            const handleSelect = () => {
              onDaySelect(day.isoDate, td);
            };
            td.addEventListener("click", handleSelect);
            td.addEventListener("keydown", (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleSelect();
              }
            });
          }
        }
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function buildMonthNode(month, weekdayLabels, options = {}) {
  const templateRoot = monthTemplate?.content?.firstElementChild;
  if (!templateRoot) {
    throw new Error("monthTemplate が正しく設定されていません。");
  }
  const monthNode = templateRoot.cloneNode(true);

  if (options.mode === RENDER_MODE.MODAL) {
    monthNode.classList.add("calendar-month--modal");
  }

  const header = monthNode.querySelector(".month-header");
  const caption = monthNode.querySelector(".month-caption");
  const weekdayRow = monthNode.querySelector(".weekday-row");
  const weeksBody = monthNode.querySelector(".weeks");

  header.textContent = month.title;
  if (caption) {
    caption.textContent = month.title;
  }

  fillWeekdayRow(weekdayRow, weekdayLabels);
  weeksBody.replaceChildren();
  renderWeeks(weeksBody, month.weeks, options);

  return monthNode;
}

function attachMonthInteractions(monthNode, month, calendar) {
  monthNode.tabIndex = 0;
  monthNode.setAttribute("role", "button");
  monthNode.setAttribute("aria-label", `${month.title}を拡大表示`);

  monthNode.addEventListener("click", () => {
    openMonthModal(month, calendar, monthNode);
  });
  monthNode.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMonthModal(month, calendar, monthNode);
    }
  });
}

function clearDynamicDetailContent(section) {
  section.querySelectorAll("[data-detail-dynamic]").forEach((node) => node.remove());
}

function createDayDetailPanel() {
  const section = document.createElement("section");
  section.className = "day-detail-panel";

  const title = document.createElement("h3");
  title.className = "day-detail-panel__title";
  title.textContent = "取引詳細";

  const message = document.createElement("p");
  message.className = "day-detail-panel__message";
  message.textContent = "日付を選択してください。";

  section.append(title, message);
  return { section, title, message };
}

function showDayDetailPlaceholder(panel, text) {
  clearDynamicDetailContent(panel.section);
  panel.message.textContent = text;
  panel.message.hidden = false;
}

function renderDayDetail(panel, isoDate, summary, trades) {
  panel.title.textContent = `取引詳細 (${formatJapaneseDate(isoDate)})`;
  clearDynamicDetailContent(panel.section);

  if (!Array.isArray(trades) || trades.length === 0) {
    showDayDetailPlaceholder(panel, "取引はありません。");
    return;
  }

  panel.message.hidden = true;

  const summaryNode = document.createElement("p");
  summaryNode.className = "day-detail-panel__summary";
  summaryNode.dataset.detailDynamic = "true";
  const summaryTexts = [
    `合計損益: ${formatCurrencyJPY(summary?.netProfit ?? 0)}`,
    `件数: ${summary?.tradeCount ?? trades.length}件`,
  ];
  if (summary) {
    summaryTexts.push(`買い: ${summary.buyCount}件 / 売り: ${summary.sellCount}件`);
    summaryTexts.push(`取引数量: ${summary.totalQuantity}枚`);
  }
  summaryNode.innerText = summaryTexts.join(" / ");
  panel.section.appendChild(summaryNode);

  const list = document.createElement("ul");
  list.className = "trade-list";
  list.dataset.detailDynamic = "true";

  trades.forEach((trade) => {
    const item = document.createElement("li");
    item.className = "trade-list__item";

    const header = document.createElement("div");
    header.className = "trade-list__header";
    const timeSpan = document.createElement("span");
    timeSpan.className = "trade-list__time";
    timeSpan.textContent = trade.isoTime ?? "--:--";
    const productSpan = document.createElement("span");
    productSpan.className = "trade-list__product";
    const productLabel = [trade.symbol, trade.contractMonth].filter(Boolean).join(" ");
    productSpan.textContent = productLabel || "-";
    header.append(timeSpan, productSpan);

    const meta = document.createElement("div");
    meta.className = "trade-list__meta";
    const sideSpan = document.createElement("span");
    sideSpan.textContent =
      trade.action && trade.action !== "-"
        ? `${trade.side} / ${trade.action}`
        : trade.side || "-";
    const qtySpan = document.createElement("span");
    qtySpan.textContent = `${trade.quantity ?? 0}枚 @ ${formatPrice(trade.price)}`;
    meta.append(sideSpan, qtySpan);

    const footer = document.createElement("div");
    footer.className = "trade-list__footer";
    const feeSpan = document.createElement("span");
    feeSpan.textContent = `手数料: ${trade.fee ? `${trade.fee.toLocaleString("ja-JP")}円` : "0円"}`;
    const grossSpan = document.createElement("span");
    grossSpan.textContent = `売買損益: ${formatCurrencyJPY(trade.grossProfit)}`;
    footer.append(feeSpan, grossSpan);

    const pnl = document.createElement("span");
    pnl.className = "trade-list__pnl";
    pnl.textContent = formatCurrencyJPY(trade.netProfit);
    if (trade.netProfit > 0) {
      pnl.classList.add("profit");
    } else if (trade.netProfit < 0) {
      pnl.classList.add("loss");
    } else {
      pnl.classList.add("neutral");
    }

    item.append(header, meta, footer, pnl);
    list.appendChild(item);
  });

  panel.section.appendChild(list);
}

function openMonthModal(month, calendar, sourceNode) {
  if (!monthModal || !modalCalendarContainer) {
    return;
  }

  const weekdayLabels = Array.isArray(calendar.weekdayLabels) ? calendar.weekdayLabels : [];
  const tradeSummaries =
    calendar && typeof calendar === "object" && calendar.tradeSummaries
      ? calendar.tradeSummaries
      : {};
  const dailyTrades =
    calendar && typeof calendar === "object" && calendar.dailyTrades
      ? calendar.dailyTrades
      : {};

  let selectedCell = null;
  const detailPanel = createDayDetailPanel();

  const handleDaySelect = (isoDate, td) => {
    if (!isoDate) {
      return;
    }
    if (selectedCell) {
      selectedCell.classList.remove("is-selected");
    }
    selectedCell = td;
    selectedCell.classList.add("is-selected");
    renderDayDetail(detailPanel, isoDate, tradeSummaries[isoDate], dailyTrades[isoDate]);
  };

  const monthNode = buildMonthNode(month, weekdayLabels, {
    mode: RENDER_MODE.MODAL,
    tradeSummaries,
    onDaySelect: handleDaySelect,
  });

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "month-modal__content";
  const calendarWrapper = document.createElement("div");
  calendarWrapper.className = "month-modal__calendar-wrapper";
  calendarWrapper.appendChild(monthNode);
  contentWrapper.append(calendarWrapper, detailPanel.section);

  modalCalendarContainer.replaceChildren(contentWrapper);
  monthModal.classList.add("is-open");
  monthModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  lastFocusedMonth = sourceNode ?? null;
  modalCloseButton?.focus();

  const initialCell =
    monthNode.querySelector("[data-date].has-trade") ??
    monthNode.querySelector("[data-date]");
  if (initialCell) {
    const isoDate = initialCell.getAttribute("data-date");
    handleDaySelect(isoDate, initialCell);
  } else {
    showDayDetailPlaceholder(detailPanel, `${month.title}の取引はありません。`);
  }
}

function closeMonthModal() {
  if (!monthModal || !modalCalendarContainer) {
    return;
  }
  if (!monthModal.classList.contains("is-open")) {
    return;
  }
  modalCalendarContainer.replaceChildren();
  monthModal.classList.remove("is-open");
  monthModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  if (lastFocusedMonth instanceof HTMLElement) {
    lastFocusedMonth.focus();
  }
}

function renderCalendar(calendar) {
  latestCalendarPayload = calendar;
  calendarElement.replaceChildren();
  const weekdayLabels = Array.isArray(calendar.weekdayLabels)
    ? calendar.weekdayLabels
    : [];
  const tradeSummaries =
    calendar && typeof calendar === "object" && calendar.tradeSummaries
      ? calendar.tradeSummaries
      : {};

  calendar.months.forEach((month) => {
    const monthNode = buildMonthNode(month, weekdayLabels, {
      mode: RENDER_MODE.GRID,
      tradeSummaries,
    });
    calendarElement.appendChild(monthNode);
    attachMonthInteractions(monthNode, month, calendar);
  });
}

async function fetchCalendar(year) {
  const response = await fetch(`/api/calendar?year=${encodeURIComponent(year)}`);
  if (!response.ok) {
    let errorMessage = `カレンダーを取得できませんでした (${response.status})`;
    const bodyText = await response.text().catch(() => "");
    if (bodyText) {
      let errorDetail = bodyText;
      try {
        const data = JSON.parse(bodyText);
        if (data && typeof data === "object") {
          if (typeof data.error === "string" && data.error) {
            errorDetail = data.error;
          } else if (typeof data.message === "string" && data.message) {
            errorDetail = data.message;
          }
        }
      } catch {
        // JSON に変換できない場合は生テキストを利用する
      }
      errorMessage += `: ${errorDetail}`;
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

async function loadCalendar(year) {
  try {
    const calendar = await fetchCalendar(year);
    renderCalendar(calendar);
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "カレンダーを読み込めませんでした。";
    const paragraph = document.createElement("p");
    paragraph.className = "error";
    paragraph.textContent = message;
    calendarElement.replaceChildren(paragraph);
  }
}

function initYearForm() {
  const currentYear = new Date().getFullYear();
  yearInput.value = String(currentYear);

  yearForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const year = Number.parseInt(yearInput.value, 10);
    const isValid = !Number.isNaN(year) && year > 0 && year <= 9999;
    if (yearError) {
      yearError.textContent = isValid ? "" : "年は1から9999までの整数を入力してください";
    }

    if (!isValid) {
      return;
    }
    loadCalendar(year);
  });
}

function initMonthModal() {
  if (!monthModal || !modalCalendarContainer) {
    return;
  }

  document.querySelectorAll("[data-modal-close]").forEach((element) => {
    element.addEventListener("click", () => {
      closeMonthModal();
    });
  });

  monthModal.addEventListener("click", (event) => {
    if (event.target === monthModal) {
      closeMonthModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && monthModal.classList.contains("is-open")) {
      closeMonthModal();
    }
  });
}

function init() {
  if (
    !calendarElement ||
    !yearForm ||
    !yearInput ||
    !yearError ||
    !monthTemplate ||
    !monthModal ||
    !modalCalendarContainer ||
    !modalCloseButton
  ) {
    console.error("必要なUI要素が見つかりませんでした:", {
      calendarElement: !!calendarElement,
      yearForm: !!yearForm,
      yearInput: !!yearInput,
      yearError: !!yearError,
      monthTemplate: !!monthTemplate,
      monthModal: !!monthModal,
      modalCalendarContainer: !!modalCalendarContainer,
      modalCloseButton: !!modalCloseButton,
    });
    return;
  }

  initYearForm();
  initMonthModal();
  const initialYear = Number.parseInt(yearInput.value, 10);
  void loadCalendar(initialYear);
}

document.addEventListener("DOMContentLoaded", init);
