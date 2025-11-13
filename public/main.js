const calendarElement = document.getElementById("calendar");
const yearForm = document.getElementById("yearForm");
const yearInput = document.getElementById("yearInput");
const yearError = document.getElementById("yearError");
const monthTemplate = document.getElementById("monthTemplate");
const monthModal = document.getElementById("monthModal");
const modalCalendarContainer = document.getElementById("modalCalendarContainer");
const modalCloseButton = document.getElementById("modalCloseButton");
const yearChartTrigger = document.getElementById("yearChartTrigger");
const yearChartModal = document.getElementById("yearChartModal");
const yearChartContainer = document.getElementById("yearChartContainer");
const yearChartCloseButton = document.getElementById("yearChartCloseButton");
const csvForm = document.getElementById("csvForm");
const csvPathInput = document.getElementById("csvPathInput");
const csvResetButton = document.getElementById("csvResetButton");
const csvError = document.getElementById("csvError");
const csvStatus = document.getElementById("csvStatus");

const RENDER_MODE = {
  GRID: "grid",
  MODAL: "modal",
};

function getEffectiveYearValue() {
  const parsed = Number.parseInt(yearInput?.value ?? "", 10);
  if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 9999) {
    return parsed;
  }
  const fallback = new Date().getFullYear();
  return fallback;
}

function setCsvError(message) {
  if (csvError) {
    csvError.textContent = message ?? "";
  }
}

function setCsvStatus(message) {
  if (csvStatus) {
    csvStatus.textContent = message ?? "";
  }
}

let lastFocusedMonth = null;
let lastFocusedYearChartTrigger = null;
let latestCalendarPayload = null;
let activeCsvPath = null;

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

function collectMonthDates(month) {
  const dates = [];
  month.weeks.forEach((week) => {
    week.forEach((day) => {
      if (day) {
        dates.push(day.isoDate);
      }
    });
  });
  return dates;
}

function collectCalendarDates(calendar) {
  const dates = [];
  calendar.months.forEach((month) => {
    dates.push(...collectMonthDates(month));
  });
  return dates;
}

function buildCumulativeSeriesFromDates(dates, tradeSummaries) {
  const series = [];
  let cumulative = 0;
  dates.forEach((isoDate) => {
    const summary = tradeSummaries[isoDate];
    const value = summary ? summary.netProfit : 0;
    cumulative += value;
    series.push({
      isoDate,
      value,
      cumulative,
    });
  });
  return series;
}

function buildCumulativeSeries(month, tradeSummaries) {
  const dates = collectMonthDates(month);
  return buildCumulativeSeriesFromDates(dates, tradeSummaries);
}

function buildPolylinePoints(series, width, height, paddingX, paddingY) {
  if (series.length === 0) {
    return { pointsAttribute: "", coordinates: [], min: 0, max: 0 };
  }
  const values = series.map((item) => item.cumulative);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = Math.max(max - min, 1);
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;
  const step = series.length > 1 ? chartWidth / (series.length - 1) : 0;

  const coordinates = series.map((point, index) => {
    const x = paddingX + (series.length > 1 ? step * index : chartWidth / 2);
    const normalized = (point.cumulative - min) / range;
    const y = paddingY + chartHeight - normalized * chartHeight;
    return { x, y };
  });

  const pointsAttribute = coordinates
    .map((coord) => `${coord.x.toFixed(2)},${coord.y.toFixed(2)}`)
    .join(" ");

  return { pointsAttribute, coordinates, min, max };
}

function createZeroLine(series, width, height, paddingX, paddingY) {
  const values = series.map((item) => item.cumulative);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  if ((min <= 0 && max >= 0) || (min === 0 && max === 0)) {
    const range = Math.max(max - min, 1);
    const chartHeight = height - paddingY * 2;
    const zeroNormalized = (0 - min) / range;
    const zeroY = paddingY + chartHeight - zeroNormalized * chartHeight;
    return {
      x1: paddingX,
      x2: width - paddingX,
      y: zeroY,
    };
  }
  return null;
}

function positionTooltip(tooltip, wrapperRect, x, y) {
  const tooltipRect = tooltip.getBoundingClientRect();
  const offsetX = 12;
  const offsetY = 12;
  let left = x - wrapperRect.left + offsetX;
  let top = y - wrapperRect.top - offsetY;

  if (left + tooltipRect.width > wrapperRect.width) {
    left = wrapperRect.width - tooltipRect.width - 8;
  }
  if (left < 0) {
    left = 8;
  }

  if (top < 0) {
    top = y - wrapperRect.top + offsetY;
  }
  tooltip.style.transform = `translate(${left}px, ${top}px)`;
}

function createCumulativeChartFromSeries(series, options = {}) {
  const {
    title = "積み上げ損益",
    ariaLabel = "積み上げ損益の推移",
    emptyMessage = "この期間の取引はありません。",
    width = 120,
    height = 70,
    paddingX = 12,
    paddingY = 12,
  } = options;

  const container = document.createElement("figure");
  container.className = "month-chart";

  const caption = document.createElement("figcaption");
  caption.className = "month-chart__title";
  caption.textContent = title;
  container.appendChild(caption);

  if (series.length === 0) {
    const empty = document.createElement("p");
    empty.className = "month-chart__empty";
    empty.textContent = emptyMessage;
    container.appendChild(empty);
    return container;
  }

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", ariaLabel);

  const baseline = document.createElementNS(ns, "rect");
  baseline.setAttribute("x", "0");
  baseline.setAttribute("y", "0");
  baseline.setAttribute("width", String(width));
  baseline.setAttribute("height", String(height));
  baseline.setAttribute("fill", "transparent");
  svg.appendChild(baseline);

  const zeroLine = createZeroLine(series, width, height, paddingX, paddingY);
  if (zeroLine) {
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", zeroLine.x1.toString());
    line.setAttribute("x2", zeroLine.x2.toString());
    line.setAttribute("y1", zeroLine.y.toString());
    line.setAttribute("y2", zeroLine.y.toString());
    line.setAttribute("class", "month-chart__zero-line");
    svg.appendChild(line);
  }

  const { pointsAttribute, coordinates, min, max } = buildPolylinePoints(
    series,
    width,
    height,
    paddingX,
    paddingY,
  );
  const range = Math.max(max - min, 1);
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const yAxis = document.createElementNS(ns, "line");
  yAxis.setAttribute("x1", paddingX.toString());
  yAxis.setAttribute("x2", paddingX.toString());
  yAxis.setAttribute("y1", paddingY.toString());
  yAxis.setAttribute("y2", (height - paddingY).toString());
  yAxis.setAttribute("class", "month-chart__axis");
  svg.appendChild(yAxis);

  const xAxis = document.createElementNS(ns, "line");
  xAxis.setAttribute("x1", paddingX.toString());
  xAxis.setAttribute("x2", (width - paddingX).toString());
  xAxis.setAttribute("y1", (height - paddingY).toString());
  xAxis.setAttribute("y2", (height - paddingY).toString());
  xAxis.setAttribute("class", "month-chart__axis");
  svg.appendChild(xAxis);

  const yGridSteps = 4;
  for (let i = 0; i <= yGridSteps; i += 1) {
    const value = min + (range / yGridSteps) * i;
    const normalized = (value - min) / range;
    const y = paddingY + chartHeight - normalized * chartHeight;
    const gridLine = document.createElementNS(ns, "line");
    gridLine.setAttribute("x1", paddingX.toString());
    gridLine.setAttribute("x2", (width - paddingX).toString());
    gridLine.setAttribute("y1", y.toString());
    gridLine.setAttribute("y2", y.toString());
    gridLine.setAttribute("class", "month-chart__grid month-chart__grid--y");
    svg.appendChild(gridLine);

    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", paddingX.toString());
    label.setAttribute("y", (y - 1).toString());
    label.setAttribute("class", "month-chart__axis-label");
    label.textContent = `${Math.round(value).toLocaleString("ja-JP")}円`;
    svg.appendChild(label);
  }

  const dayThreshold = 10;
  series.forEach((point, index) => {
    const isoDate = point.isoDate;
    const day = Number.parseInt(isoDate.slice(-2), 10);
    if (Number.isNaN(day) || day === 0 || day % dayThreshold !== 0) {
      return;
    }
    const coord = coordinates[index];
    if (!coord) {
      return;
    }
    const gridLine = document.createElementNS(ns, "line");
    gridLine.setAttribute("x1", coord.x.toString());
    gridLine.setAttribute("x2", coord.x.toString());
    gridLine.setAttribute("y1", paddingY.toString());
    gridLine.setAttribute("y2", (height - paddingY).toString());
    gridLine.setAttribute("class", "month-chart__grid month-chart__grid--x");
    svg.appendChild(gridLine);

    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", coord.x.toString());
    label.setAttribute("y", (height - paddingY + 6).toString());
    label.setAttribute("class", "month-chart__axis-label month-chart__axis-label--x");
    label.textContent = `${day}日`;
    svg.appendChild(label);
  });

  const polyline = document.createElementNS(ns, "polyline");
  polyline.setAttribute("points", pointsAttribute);
  polyline.setAttribute("class", "month-chart__line");
  svg.appendChild(polyline);

  const yUnitLabel = document.createElementNS(ns, "text");
  const yUnitX = paddingX - 8;
  const yUnitY = paddingY + chartHeight / 2;
  yUnitLabel.setAttribute("x", yUnitX.toString());
  yUnitLabel.setAttribute("y", yUnitY.toString());
  yUnitLabel.setAttribute("class", "month-chart__axis-unit");
  yUnitLabel.setAttribute("transform", `rotate(-90 ${yUnitX} ${yUnitY})`);
  yUnitLabel.textContent = "円";
  svg.appendChild(yUnitLabel);

  const xUnitLabel = document.createElementNS(ns, "text");
  xUnitLabel.setAttribute("x", (paddingX + chartWidth / 2).toString());
  xUnitLabel.setAttribute("y", (height - paddingY + 14).toString());
  xUnitLabel.setAttribute("class", "month-chart__axis-unit month-chart__axis-unit--x");
  xUnitLabel.textContent = "日";
  svg.appendChild(xUnitLabel);

  const marker = document.createElementNS(ns, "circle");
  marker.setAttribute("r", "1.8");
  marker.setAttribute("class", "month-chart__marker");
  svg.appendChild(marker);

  const chartFigure = document.createElement("div");
  chartFigure.className = "month-chart__figure";
  chartFigure.appendChild(svg);
  const tooltip = document.createElement("div");
  tooltip.className = "month-chart__tooltip";
  tooltip.hidden = true;
  chartFigure.appendChild(tooltip);

  const endValue = series[series.length - 1].cumulative;
  const totalText = document.createElement("p");
  totalText.className = "month-chart__total";
  totalText.textContent = `累計: ${formatCurrencyJPY(endValue)}`;

  chartFigure.addEventListener("pointermove", (event) => {
    const rect = chartFigure.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const index = Math.min(
      series.length - 1,
      Math.max(0, Math.round((Number.isFinite(ratio) ? ratio : 0) * (series.length - 1))),
    );
    const coord = coordinates[index];
    if (!coord) {
      return;
    }
    marker.setAttribute("cx", coord.x.toString());
    marker.setAttribute("cy", coord.y.toString());
    marker.classList.add("is-visible");
    tooltip.hidden = false;
    tooltip.replaceChildren();
    const tooltipDate = document.createElement("strong");
    tooltipDate.textContent = formatJapaneseDate(series[index].isoDate);
    const tooltipDaily = document.createElement("span");
    tooltipDaily.textContent = `日次: ${formatCurrencyJPY(series[index].value)}`;
    const tooltipCumulative = document.createElement("span");
    tooltipCumulative.textContent = `累計: ${formatCurrencyJPY(series[index].cumulative)}`;
    tooltip.append(tooltipDate, tooltipDaily, tooltipCumulative);
    positionTooltip(tooltip, rect, event.clientX, event.clientY);
  });

  chartFigure.addEventListener("pointerleave", () => {
    marker.classList.remove("is-visible");
    tooltip.hidden = true;
  });

  container.append(chartFigure, totalText);
  return container;
}

function createCumulativeChart(month, tradeSummaries) {
  const series = buildCumulativeSeries(month, tradeSummaries);
  return createCumulativeChartFromSeries(series, {
    title: "積み上げ損益",
    ariaLabel: `${month.title}の積み上げ損益推移`,
  });
}

function createYearlyCumulativeChart(calendar, tradeSummaries) {
  const dates = collectCalendarDates(calendar);
  const series = buildCumulativeSeriesFromDates(dates, tradeSummaries);
  return createCumulativeChartFromSeries(series, {
    title: `${calendar.year}年の積み上げ損益`,
    ariaLabel: `${calendar.year}年の積み上げ損益推移`,
    emptyMessage: `${calendar.year}年の取引はありません。`,
    width: 220,
    height: 110,
    paddingX: 16,
    paddingY: 16,
  });
}

function openYearChartModal(calendar) {
  if (!yearChartModal || !yearChartContainer) {
    return;
  }
  const targetCalendar = calendar ?? latestCalendarPayload;
  if (!targetCalendar) {
    return;
  }
  const tradeSummaries =
    targetCalendar && typeof targetCalendar === "object" && targetCalendar.tradeSummaries
      ? targetCalendar.tradeSummaries
      : {};
  const chart = createYearlyCumulativeChart(targetCalendar, tradeSummaries);
  yearChartContainer.replaceChildren(chart);
  yearChartModal.classList.add("is-open");
  yearChartModal.setAttribute("aria-hidden", "false");
  if (!document.body.classList.contains("modal-open")) {
    document.body.classList.add("modal-open");
  }
  yearChartCloseButton?.focus();
}

function closeYearChartModal(options = {}) {
  const { restoreFocus = true } = options;
  if (!yearChartModal || !yearChartContainer) {
    return;
  }
  if (!yearChartModal.classList.contains("is-open")) {
    return;
  }
  yearChartContainer.replaceChildren();
  yearChartModal.classList.remove("is-open");
  yearChartModal.setAttribute("aria-hidden", "true");
  if (!monthModal || !monthModal.classList.contains("is-open")) {
    document.body.classList.remove("modal-open");
  }
  if (restoreFocus && lastFocusedYearChartTrigger instanceof HTMLElement) {
    lastFocusedYearChartTrigger.focus();
  }
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
  const chartNode = createCumulativeChart(month, tradeSummaries);

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "month-modal__content";
  const calendarWrapper = document.createElement("div");
  calendarWrapper.className = "month-modal__calendar-wrapper";
  calendarWrapper.append(monthNode, chartNode);
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
  closeYearChartModal({ restoreFocus: false });
  modalCalendarContainer.replaceChildren();
  monthModal.classList.remove("is-open");
  monthModal.setAttribute("aria-hidden", "true");
  if (!yearChartModal || !yearChartModal.classList.contains("is-open")) {
    document.body.classList.remove("modal-open");
  }
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

async function fetchCalendar(year, options = {}) {
  const params = new URLSearchParams({ year: String(year) });
  if (options.csvPath) {
    params.set("csvPath", options.csvPath);
  }
  const response = await fetch(`/api/calendar?${params.toString()}`);
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
    const calendar = await fetchCalendar(year, { csvPath: activeCsvPath });
    renderCalendar(calendar);
    return true;
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "カレンダーを読み込めませんでした。";
    const paragraph = document.createElement("p");
    paragraph.className = "error";
    paragraph.textContent = message;
    calendarElement.replaceChildren(paragraph);
    return false;
  }
}

function initYearForm() {
  const currentYear = new Date().getFullYear();
  if (!yearInput.value) {
    yearInput.value = String(currentYear);
  }

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
    void loadCalendar(year);
  });
}

function initYearChartTrigger() {
  if (!yearChartTrigger) {
    return;
  }
  yearChartTrigger.addEventListener("click", () => {
    if (!latestCalendarPayload) {
      return;
    }
    lastFocusedYearChartTrigger = yearChartTrigger;
    openYearChartModal(latestCalendarPayload);
  });
}

function initCsvForm() {
  if (!csvForm || !csvPathInput) {
    return;
  }

  setCsvStatus("デフォルトのCSVを使用します。");

  csvForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = csvPathInput.value.trim();
    if (!value) {
      setCsvError("CSVファイルのパスを入力してください。");
      return;
    }
    setCsvError("");
    activeCsvPath = value;
    setCsvStatus(`指定中: ${value}`);
    const year = getEffectiveYearValue();
    const success = await loadCalendar(year);
    if (!success) {
      setCsvError("CSVの読み込みに失敗しました。パスをご確認ください。");
    }
  });

  if (csvResetButton) {
    csvResetButton.addEventListener("click", async () => {
      csvPathInput.value = "";
      activeCsvPath = null;
      setCsvError("");
      setCsvStatus("デフォルトのCSVを使用します。");
      const year = getEffectiveYearValue();
      await loadCalendar(year);
    });
  }
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
    if (
      event.key === "Escape" &&
      monthModal.classList.contains("is-open") &&
      (!yearChartModal || !yearChartModal.classList.contains("is-open"))
    ) {
      closeMonthModal();
    }
  });
}

function initYearChartModal() {
  if (!yearChartModal || !yearChartContainer) {
    return;
  }

  document.querySelectorAll("[data-year-chart-close]").forEach((element) => {
    element.addEventListener("click", () => {
      closeYearChartModal();
    });
  });

  yearChartModal.addEventListener("click", (event) => {
    if (event.target === yearChartModal) {
      closeYearChartModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && yearChartModal.classList.contains("is-open")) {
      event.preventDefault();
      event.stopPropagation();
      closeYearChartModal();
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
    !modalCloseButton ||
    !yearChartTrigger ||
    !yearChartModal ||
    !yearChartContainer ||
    !yearChartCloseButton
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
      yearChartTrigger: !!yearChartTrigger,
      yearChartModal: !!yearChartModal,
      yearChartContainer: !!yearChartContainer,
      yearChartCloseButton: !!yearChartCloseButton,
    });
    return;
  }

  initYearForm();
  initCsvForm();
  initYearChartTrigger();
  initMonthModal();
  initYearChartModal();
  const initialYear = Number.parseInt(yearInput.value, 10);
  void loadCalendar(initialYear);
}

document.addEventListener("DOMContentLoaded", init);
