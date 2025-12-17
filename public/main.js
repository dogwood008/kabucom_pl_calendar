import { fetchCalendarData } from "./calendarApi.js";
import { fetchSpreadsheetCsv } from "./spreadsheetApi.js";

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
const chartZoomModal = document.getElementById("chartZoomModal");
const chartZoomContainer = document.getElementById("chartZoomContainer");
const chartZoomCloseButton = document.getElementById("chartZoomCloseButton");
const chartZoomTitle = document.getElementById("chartZoomTitle");
const csvFileInput = document.getElementById("csvFileInput");
const csvResetButton = document.getElementById("csvResetButton");
const csvError = document.getElementById("csvError");
const csvStatus = document.getElementById("csvStatus");
const csvFileName = document.getElementById("csvFileName");
const csvFileTrigger = document.querySelector("[data-csv-trigger]");
const spreadsheetEndpointInput = document.getElementById("spreadsheetEndpointInput");
const spreadsheetFetchButton = document.getElementById("spreadsheetFetchButton");
const spreadsheetResetButton = document.getElementById("spreadsheetResetButton");
const spreadsheetStatus = document.getElementById("spreadsheetStatus");
const spreadsheetError = document.getElementById("spreadsheetError");
const spreadsheetPskInput = document.getElementById("spreadsheetPskInput");
const spreadsheetSavePskCheckbox = document.getElementById("spreadsheetSavePskCheckbox");

const RENDER_MODE = {
  GRID: "grid",
  MODAL: "modal",
};

const ZOOM_CHART_DIMENSIONS = {
  width: 420,
  height: 220,
  paddingX: 24,
  paddingY: 24,
};

const DAILY_CHART_TICK_RATIOS = [0.25, 0.5, 0.75];
const SPREADSHEET_ENDPOINT_STORAGE_KEY = "spreadsheetEndpointUrl";
const SPREADSHEET_PSK_STORAGE_KEY = "spreadsheetPsk";
const DEFAULT_SPREADSHEET_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbzIxdVW1G20fnrMeysplw2CQ3r2-qBgRd3dUBC97iRRkVbWNxAtC6OVQx9xnG1dNw/exec";
const DEFAULT_SPREADSHEET_PSK = "testpsk";

function countReplacementChars(text) {
  if (!text) {
    return 0;
  }
  const matches = text.match(/\ufffd/g);
  return matches ? matches.length : 0;
}

function decodeCsvArrayBuffer(buffer) {
  if (!(buffer instanceof ArrayBuffer)) {
    return "";
  }
  const utf8Text = new TextDecoder("utf-8").decode(buffer);
  const utf8ReplacementCount = countReplacementChars(utf8Text);
  if (utf8ReplacementCount === 0) {
    return utf8Text;
  }

  try {
    const shiftJisText = new TextDecoder("shift_jis").decode(buffer);
    const shiftJisReplacementCount = countReplacementChars(shiftJisText);
    if (shiftJisReplacementCount === 0 || shiftJisReplacementCount < utf8ReplacementCount) {
      return shiftJisText;
    }
  } catch (error) {
    console.warn("Shift_JIS でのデコードに失敗したため UTF-8 を使用します:", error);
  }

  return utf8Text;
}

async function readCsvFileWithFallback(file) {
  if (!(file instanceof File)) {
    return "";
  }
  const buffer = await file.arrayBuffer();
  return decodeCsvArrayBuffer(buffer);
}

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

function setCsvFileName(text) {
  if (csvFileName) {
    csvFileName.textContent = text ?? "";
  }
}

function setSpreadsheetError(message) {
  if (spreadsheetError) {
    spreadsheetError.textContent = message ?? "";
  }
}

function setSpreadsheetStatus(message) {
  if (spreadsheetStatus) {
    spreadsheetStatus.textContent = message ?? "";
  }
}

function resetSpreadsheetDefaults() {
  if (!spreadsheetEndpointInput || !spreadsheetPskInput || !spreadsheetSavePskCheckbox) {
    return;
  }
  spreadsheetEndpointInput.value = DEFAULT_SPREADSHEET_ENDPOINT;
  spreadsheetPskInput.value = DEFAULT_SPREADSHEET_PSK;
  spreadsheetSavePskCheckbox.checked = false;
}

function readSavedSpreadsheetEndpoint() {
  try {
    return localStorage.getItem(SPREADSHEET_ENDPOINT_STORAGE_KEY);
  } catch (error) {
    console.warn("保存済みのエンドポイントを読み取れませんでした", error);
    return null;
  }
}

function saveSpreadsheetEndpoint(value) {
  try {
    if (value) {
      localStorage.setItem(SPREADSHEET_ENDPOINT_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(SPREADSHEET_ENDPOINT_STORAGE_KEY);
    }
  } catch (error) {
    console.warn("エンドポイントの保存に失敗しました", error);
  }
}

function readSavedSpreadsheetPsk() {
  try {
    return localStorage.getItem(SPREADSHEET_PSK_STORAGE_KEY);
  } catch (error) {
    console.warn("保存済みのPSKを読み取れませんでした", error);
    return null;
  }
}

function saveSpreadsheetPsk(value) {
  try {
    if (value) {
      localStorage.setItem(SPREADSHEET_PSK_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(SPREADSHEET_PSK_STORAGE_KEY);
    }
  } catch (error) {
    console.warn("PSKの保存に失敗しました", error);
  }
}

function applyDefaultCsvUiState() {
  setCsvError("");
  setCsvFileName("未選択");
  setCsvStatus("デフォルトのCSVを使用します。");
}

async function resetToDefaultCsv() {
  activeCsvContent = null;
  applyDefaultCsvUiState();
  setSpreadsheetError("");
  const savedEndpoint = readSavedSpreadsheetEndpoint();
  const spreadsheetMessage = savedEndpoint
    ? "保存済みのエンドポイントがあります。必要に応じて取得してください。"
    : "スプレッドシート未取得です。URLを入力してください。";
  setSpreadsheetStatus(spreadsheetMessage);
  const year = getEffectiveYearValue();
  await loadCalendar(year);
}

async function applyCsvContent(csvContent, uiOptions = {}) {
  activeCsvContent = csvContent;
  setSpreadsheetError("");
  const year = getEffectiveYearValue();
  const success = await loadCalendar(year);
  if (!success) {
    return false;
  }
  setCsvError("");
  if (uiOptions.fileName) {
    setCsvFileName(uiOptions.fileName);
  }
  if (uiOptions.statusText) {
    setCsvStatus(uiOptions.statusText);
  }
  if (uiOptions.spreadsheetStatusText) {
    setSpreadsheetStatus(uiOptions.spreadsheetStatusText);
  }
  return true;
}

let lastFocusedMonth = null;
let lastFocusedYearChartTrigger = null;
let lastFocusedChartZoomTrigger = null;
let latestCalendarPayload = null;
let activeCsvContent = null;

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

function parseMinutesFromTime(isoTime) {
  if (typeof isoTime !== "string") {
    return undefined;
  }
  const [hoursPart, minutesPart] = isoTime.split(":");
  const hours = Number.parseInt(hoursPart ?? "", 10);
  const minutes = Number.parseInt(minutesPart ?? "", 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return undefined;
  }
  return hours * 60 + minutes;
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

function buildDailyCumulativeSeries(isoDate, trades) {
  if (!isoDate || !Array.isArray(trades) || trades.length === 0) {
    return [];
  }
  let cumulative = 0;
  const sortedTrades = [...trades].sort((a, b) => {
    const timeA =
      a?.isoTime ??
      (typeof a?.isoDateTime === "string" ? a.isoDateTime.split("T")[1] : undefined) ??
      "00:00:00";
    const timeB =
      b?.isoTime ??
      (typeof b?.isoDateTime === "string" ? b.isoDateTime.split("T")[1] : undefined) ??
      "00:00:00";
    return timeA.localeCompare(timeB);
  });
  return sortedTrades.map((trade, index) => {
    const net = typeof trade?.netProfit === "number" ? trade.netProfit : 0;
    cumulative += net;
    const isoTime =
      trade?.isoTime ??
      (typeof trade?.isoDateTime === "string"
        ? trade.isoDateTime.split("T")[1]?.slice(0, 5)
        : undefined);
    return {
      isoDate,
      isoDateTime: trade?.isoDateTime ?? `${isoDate}T${isoTime ?? "00:00"}`,
      isoTime: isoTime ?? "--:--",
      value: net,
      cumulative,
      minutesFromMidnight: parseMinutesFromTime(isoTime),
      index,
    };
  });
}

function buildPolylinePoints(series, width, height, paddingX, paddingY, options = {}) {
  if (series.length === 0) {
    return { pointsAttribute: "", coordinates: [], min: 0, max: 0, xValues: [], xMin: 0, xMax: 0 };
  }
  const { xAccessor } = options;
  const values = series.map((item) => item.cumulative);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = Math.max(max - min, 1);
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;
  const xValues =
    typeof xAccessor === "function"
      ? series.map((point, index) => {
          const resolved = xAccessor(point, index);
          return typeof resolved === "number" && Number.isFinite(resolved) ? resolved : index;
        })
      : null;
  const xMin = xValues ? Math.min(...xValues) : 0;
  const xMax = xValues ? Math.max(...xValues) : series.length - 1;
  const xRange = Math.max(xMax - xMin, 1);

  const coordinates = series.map((point, index) => {
    const progress = xValues
      ? xRange === 0
        ? 0.5
        : (xValues[index] - xMin) / xRange
      : series.length > 1
        ? index / (series.length - 1)
        : 0.5;
    const x = paddingX + progress * chartWidth;
    const normalized = (point.cumulative - min) / range;
    const y = paddingY + chartHeight - normalized * chartHeight;
    return { x, y };
  });

  const pointsAttribute = coordinates
    .map((coord) => `${coord.x.toFixed(2)},${coord.y.toFixed(2)}`)
    .join(" ");

  return { pointsAttribute, coordinates, min, max, xValues: xValues ?? [], xMin, xMax };
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

function createDefaultMonthChartTicks({ series, coordinates, height, paddingY }) {
  const dayThreshold = 10;
  return series
    .map((point, index) => {
      const day = Number.parseInt(point?.isoDate?.slice(-2) ?? "", 10);
      if (Number.isNaN(day) || day === 0 || day % dayThreshold !== 0) {
        return null;
      }
      const coord = coordinates[index];
      if (!coord) {
        return null;
      }
      return {
        x: coord.x,
        label: `${day}日`,
        height,
        paddingY,
      };
    })
    .filter(Boolean);
}

function formatDefaultTooltipContent(point) {
  if (!point) {
    return null;
  }
  return {
    title: formatJapaneseDate(point.isoDate),
    lines: [
      `日次: ${formatCurrencyJPY(point.value)}`,
      `累計: ${formatCurrencyJPY(point.cumulative)}`,
    ],
  };
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

function enableChartZoom(chartNode, createZoomedChart, options = {}) {
  if (
    !chartNode ||
    typeof chartNode !== "object" ||
    typeof createZoomedChart !== "function" ||
    !chartZoomModal ||
    !chartZoomContainer
  ) {
    return;
  }
  const providedLabel = options.label;
  const fallbackLabel =
    chartNode.querySelector(".month-chart__title")?.textContent ?? "グラフ";
  const label = providedLabel ?? fallbackLabel;
  const zoomTitle = `${label}の拡大表示`;
  const openZoom = () => {
    const zoomedChart = createZoomedChart();
    if (!(zoomedChart instanceof HTMLElement)) {
      return;
    }
    lastFocusedChartZoomTrigger = chartNode;
    openChartZoomModal(zoomedChart, { title: zoomTitle });
  };
  chartNode.classList.add("month-chart--zoomable");
  chartNode.tabIndex = 0;
  chartNode.setAttribute("role", "button");
  chartNode.setAttribute("aria-label", `${label}を拡大表示`);
  chartNode.addEventListener("click", () => {
    openZoom();
  });
  chartNode.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openZoom();
    }
  });
}

function createCumulativeChartFromSeries(series, options = {}) {
  const {
    title = "累積損益",
    ariaLabel = "累積損益の推移",
    emptyMessage = "この期間の取引はありません。",
    width = 120,
    height = 70,
    paddingX = 12,
    paddingY = 12,
    xAxisUnitLabel = "日",
    xAxisTickGenerator,
    tooltipFormatter,
    xAccessor,
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

  const { pointsAttribute, coordinates, min, max, xValues, xMin, xMax } = buildPolylinePoints(
    series,
    width,
    height,
    paddingX,
    paddingY,
    { xAccessor },
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

  const resolvedTickGenerator =
    typeof xAxisTickGenerator === "function"
      ? xAxisTickGenerator
      : createDefaultMonthChartTicks;
  const ticks = resolvedTickGenerator({
    series,
    coordinates,
    height,
    paddingY,
    xValues,
    xMin,
    xMax,
  });

  ticks.forEach((tick) => {
    if (!tick || typeof tick.x !== "number" || Number.isNaN(tick.x) || !tick.label) {
      return;
    }
    const gridLine = document.createElementNS(ns, "line");
    gridLine.setAttribute("x1", tick.x.toString());
    gridLine.setAttribute("x2", tick.x.toString());
    gridLine.setAttribute("y1", paddingY.toString());
    gridLine.setAttribute("y2", (height - paddingY).toString());
    gridLine.setAttribute("class", "month-chart__grid month-chart__grid--x");
    svg.appendChild(gridLine);

    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", tick.x.toString());
    label.setAttribute("y", (height - paddingY + 6).toString());
    label.setAttribute("class", "month-chart__axis-label month-chart__axis-label--x");
    label.textContent = tick.label;
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
  xUnitLabel.textContent = xAxisUnitLabel;
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

  const resolveTooltip =
    typeof tooltipFormatter === "function" ? tooltipFormatter : formatDefaultTooltipContent;

  chartFigure.addEventListener("pointermove", (event) => {
    if (!Array.isArray(coordinates) || coordinates.length === 0) {
      return;
    }
    const rect = chartFigure.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const normalizedRatio = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
    const pointerX = normalizedRatio * width;
    let left = 0;
    let right = coordinates.length - 1;
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (coordinates[mid].x < pointerX) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    let closestIndex = left;
    if (closestIndex > 0) {
      const prevIndex = closestIndex - 1;
      const prevDistance = Math.abs(coordinates[prevIndex].x - pointerX);
      const currentDistance = Math.abs(coordinates[closestIndex].x - pointerX);
      if (prevDistance <= currentDistance) {
        closestIndex = prevIndex;
      }
    }
    const coord = coordinates[closestIndex];
    if (!coord) {
      return;
    }
    marker.setAttribute("cx", coord.x.toString());
    marker.setAttribute("cy", coord.y.toString());
    marker.classList.add("is-visible");
    const tooltipData = resolveTooltip(series[closestIndex], closestIndex, series);
    tooltip.replaceChildren();
    if (tooltipData?.title) {
      const tooltipDate = document.createElement("strong");
      tooltipDate.textContent = tooltipData.title;
      tooltip.appendChild(tooltipDate);
    }
    if (Array.isArray(tooltipData?.lines)) {
      tooltipData.lines.forEach((line) => {
        const span = document.createElement("span");
        span.textContent = line;
        tooltip.appendChild(span);
      });
    }
    if (!tooltip.hasChildNodes()) {
      tooltip.hidden = true;
      return;
    }
    tooltip.hidden = false;
    positionTooltip(tooltip, rect, event.clientX, event.clientY);
  });

  chartFigure.addEventListener("pointerleave", () => {
    marker.classList.remove("is-visible");
    tooltip.hidden = true;
  });

  container.append(chartFigure, totalText);
  return container;
}

function createCumulativeChart(month, tradeSummaries, options = {}) {
  const series = buildCumulativeSeries(month, tradeSummaries);
  return createCumulativeChartFromSeries(series, {
    title: "月次累積グラフ",
    ariaLabel: `${month.title}の月次累積グラフの推移`,
    ...options,
  });
}

function createDailyChartTicks({ series, coordinates, xValues, xMin, xMax }) {
  if (!Array.isArray(series) || series.length === 0) {
    return [];
  }
  const indices = new Set([0, series.length - 1]);
  if (Array.isArray(xValues) && xValues.length === series.length && xMax > xMin) {
    DAILY_CHART_TICK_RATIOS.forEach((ratio) => {
      const target = xMin + (xMax - xMin) * ratio;
      let nearestIndex = 0;
      let smallestDiff = Number.POSITIVE_INFINITY;
      xValues.forEach((value, idx) => {
        if (typeof value !== "number") {
          return;
        }
        const diff = Math.abs(value - target);
        if (diff < smallestDiff) {
          smallestDiff = diff;
          nearestIndex = idx;
        }
      });
      indices.add(nearestIndex);
    });
  } else if (series.length > 2) {
    indices.add(Math.floor(series.length / 2));
  }
  const seenLabels = new Set();
  return Array.from(indices)
    .sort((a, b) => a - b)
    .map((index) => {
      const coord = coordinates[index];
      const timeLabel = (series[index]?.isoTime ?? "--:--").slice(0, 5);
      if (!coord || seenLabels.has(timeLabel)) {
        return null;
      }
      seenLabels.add(timeLabel);
      return {
        x: coord.x,
        label: timeLabel,
      };
    })
    .filter(Boolean);
}

function createDailyCumulativeChart(isoDate, trades, options = {}) {
  const hasDate = typeof isoDate === "string" && isoDate.length > 0;
  const dateLabel = hasDate ? formatJapaneseDate(isoDate) : null;
  const safeTrades = Array.isArray(trades) ? trades : [];
  const series = hasDate ? buildDailyCumulativeSeries(isoDate, safeTrades) : [];
  return createCumulativeChartFromSeries(series, {
    title: hasDate && dateLabel ? `${dateLabel} の日次累積損益` : "日次累積損益",
    ariaLabel: hasDate && dateLabel ? `${dateLabel}の日次累積損益推移` : "日次累積損益",
    emptyMessage: hasDate && dateLabel ? `${dateLabel}の取引はありません。` : "日付を選択するとグラフを表示します。",
    xAxisUnitLabel: "時刻",
    xAxisTickGenerator: hasDate ? createDailyChartTicks : () => [],
    tooltipFormatter:
      hasDate && dateLabel
        ? (point) => ({
            title: `${dateLabel} ${point?.isoTime ?? "--:--"}`,
            lines: [
              `取引: ${formatCurrencyJPY(point?.value ?? 0)}`,
              `累計: ${formatCurrencyJPY(point?.cumulative ?? 0)}`,
            ],
          })
        : null,
    xAccessor: hasDate
      ? (point, index) => {
          if (typeof point?.minutesFromMidnight === "number") {
            return point.minutesFromMidnight;
          }
          const fallback = parseMinutesFromTime(point?.isoTime);
          if (typeof fallback === "number") {
            return fallback;
          }
          return index;
        }
      : undefined,
    ...options,
  });
}

function createYearlyCumulativeChart(calendar, tradeSummaries) {
  const dates = collectCalendarDates(calendar);
  const series = buildCumulativeSeriesFromDates(dates, tradeSummaries);
  return createCumulativeChartFromSeries(series, {
    title: `${calendar.year}年の累積損益`,
    ariaLabel: `${calendar.year}年の累積損益推移`,
    emptyMessage: `${calendar.year}年の取引はありません。`,
    width: 220,
    height: 110,
    paddingX: 16,
    paddingY: 16,
  });
}

function openChartZoomModal(content, options = {}) {
  if (!chartZoomModal || !chartZoomContainer || !(content instanceof HTMLElement)) {
    return;
  }
  const title = options.title ?? "グラフの拡大表示";
  chartZoomContainer.replaceChildren(content);
  if (chartZoomTitle) {
    chartZoomTitle.textContent = title;
  }
  chartZoomModal.classList.add("is-open");
  chartZoomModal.setAttribute("aria-hidden", "false");
  if (!document.body.classList.contains("modal-open")) {
    document.body.classList.add("modal-open");
  }
  chartZoomCloseButton?.focus();
}

function closeChartZoomModal(options = {}) {
  const { restoreFocus = true } = options;
  if (!chartZoomModal || !chartZoomContainer) {
    return;
  }
  if (!chartZoomModal.classList.contains("is-open")) {
    return;
  }
  chartZoomContainer.replaceChildren();
  chartZoomModal.classList.remove("is-open");
  chartZoomModal.setAttribute("aria-hidden", "true");
  if (
    (!monthModal || !monthModal.classList.contains("is-open")) &&
    (!yearChartModal || !yearChartModal.classList.contains("is-open"))
  ) {
    document.body.classList.remove("modal-open");
  }
  if (restoreFocus && lastFocusedChartZoomTrigger instanceof HTMLElement) {
    lastFocusedChartZoomTrigger.focus();
  }
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
  if (
    (!monthModal || !monthModal.classList.contains("is-open")) &&
    (!chartZoomModal || !chartZoomModal.classList.contains("is-open"))
  ) {
    document.body.classList.remove("modal-open");
  }
  if (restoreFocus && lastFocusedYearChartTrigger instanceof HTMLElement) {
    lastFocusedYearChartTrigger.focus();
  }
}

function initChartZoomModal() {
  if (!chartZoomModal || !chartZoomContainer) {
    return;
  }
  document.querySelectorAll("[data-chart-zoom-close]").forEach((element) => {
    element.addEventListener("click", () => {
      closeChartZoomModal();
    });
  });
  chartZoomModal.addEventListener("click", (event) => {
    if (event.target === chartZoomModal) {
      closeChartZoomModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && chartZoomModal.classList.contains("is-open")) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      closeChartZoomModal();
    }
  });
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
  let dayChartNode = document.createElement("div");
  dayChartNode.className = "month-modal__day-chart-placeholder";

  const makeDayChartNode = (isoDate, tradesForDay) => {
    const chart = createDailyCumulativeChart(isoDate, tradesForDay);
    enableChartZoom(chart, () =>
      createDailyCumulativeChart(isoDate, tradesForDay, ZOOM_CHART_DIMENSIONS),
    );
    return chart;
  };

  const updateDayChart = (isoDate) => {
    const tradesForDay = isoDate ? dailyTrades[isoDate] ?? [] : [];
    const nextChart = makeDayChartNode(isoDate, tradesForDay);
    dayChartNode.replaceWith(nextChart);
    dayChartNode = nextChart;
  };

  const handleDaySelect = (isoDate, td) => {
    if (!isoDate) {
      updateDayChart(null);
      return;
    }
    if (selectedCell) {
      selectedCell.classList.remove("is-selected");
    }
    selectedCell = td;
    selectedCell.classList.add("is-selected");
    renderDayDetail(detailPanel, isoDate, tradeSummaries[isoDate], dailyTrades[isoDate]);
    updateDayChart(isoDate);
  };

  const monthNode = buildMonthNode(month, weekdayLabels, {
    mode: RENDER_MODE.MODAL,
    tradeSummaries,
    onDaySelect: handleDaySelect,
  });
  const chartNode = createCumulativeChart(month, tradeSummaries);
  enableChartZoom(chartNode, () =>
    createCumulativeChart(month, tradeSummaries, ZOOM_CHART_DIMENSIONS),
  );

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "month-modal__content";
  const calendarWrapper = document.createElement("div");
  calendarWrapper.className = "month-modal__calendar-wrapper";
  const chartRow = document.createElement("div");
  chartRow.className = "month-modal__chart-row";
  chartRow.append(chartNode, dayChartNode);
  calendarWrapper.append(monthNode, chartRow);
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
    updateDayChart(null);
  }
}

function closeMonthModal() {
  if (!monthModal || !modalCalendarContainer) {
    return;
  }
  if (!monthModal.classList.contains("is-open")) {
    return;
  }
  closeChartZoomModal({ restoreFocus: false });
  closeYearChartModal({ restoreFocus: false });
  modalCalendarContainer.replaceChildren();
  monthModal.classList.remove("is-open");
  monthModal.setAttribute("aria-hidden", "true");
  if (
    (!yearChartModal || !yearChartModal.classList.contains("is-open")) &&
    (!chartZoomModal || !chartZoomModal.classList.contains("is-open"))
  ) {
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

async function loadCalendar(year) {
  try {
    const requestOptions = activeCsvContent ? { csvContent: activeCsvContent } : {};
    const calendar = await fetchCalendarData(year, requestOptions);
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

function initCsvUpload() {
  if (!csvFileInput || !csvResetButton) {
    return;
  }

  applyDefaultCsvUiState();

  if (csvFileTrigger instanceof HTMLElement) {
    csvFileTrigger.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        csvFileInput.click();
      }
    });
  }

  csvFileInput.addEventListener("change", async () => {
    const [file] = csvFileInput.files ?? [];
    if (!file) {
      setCsvFileName("未選択");
      return;
    }

    setSpreadsheetError("");
    setCsvError("");
    setCsvStatus(`${file.name} を読み込み中です…`);
    try {
      const content = await readCsvFileWithFallback(file);
      if (!content.trim()) {
        setCsvError("CSVファイルにデータがありません。");
        setCsvStatus("");
        csvFileInput.value = "";
        return;
      }
      const success = await applyCsvContent(content, {
        fileName: file.name,
        statusText: `${file.name} を使用しています。`,
        spreadsheetStatusText: "ファイルアップロードを優先しています。",
      });
      if (!success) {
        setCsvError("CSVの解析に失敗しました。ファイル内容をご確認ください。");
      }
    } catch (error) {
      console.error(error);
      setCsvError("CSVファイルの読み込みに失敗しました。");
      setCsvStatus("");
    } finally {
      csvFileInput.value = "";
    }
  });

  csvResetButton.addEventListener("click", async () => {
    await resetToDefaultCsv();
  });
}

function initSpreadsheetImport() {
  if (
    !spreadsheetEndpointInput ||
    !spreadsheetFetchButton ||
    !spreadsheetResetButton ||
    !spreadsheetStatus ||
    !spreadsheetError ||
    !spreadsheetPskInput ||
    !spreadsheetSavePskCheckbox
  ) {
    return;
  }

  const savedEndpoint = readSavedSpreadsheetEndpoint();
  if (savedEndpoint) {
    spreadsheetEndpointInput.value = savedEndpoint;
    setSpreadsheetStatus("保存済みのエンドポイントを読み込みました。");
  } else {
    if (!spreadsheetEndpointInput.value) {
      spreadsheetEndpointInput.value = DEFAULT_SPREADSHEET_ENDPOINT;
    }
    setSpreadsheetStatus("スプレッドシート未取得です。URLを入力してください。");
  }

  const savedPsk = readSavedSpreadsheetPsk();
  if (savedPsk) {
    spreadsheetPskInput.value = savedPsk;
    spreadsheetSavePskCheckbox.checked = true;
  } else {
    if (!spreadsheetPskInput.value) {
      spreadsheetPskInput.value = DEFAULT_SPREADSHEET_PSK;
    }
    spreadsheetSavePskCheckbox.checked = false;
  }

  let isFetchingSpreadsheet = false;

  spreadsheetFetchButton.addEventListener("click", async () => {
    if (isFetchingSpreadsheet) {
      return;
    }
    isFetchingSpreadsheet = true;
    setSpreadsheetError("");
    setSpreadsheetStatus("スプレッドシートから取得中です…");
    try {
      const endpoint = spreadsheetEndpointInput.value ?? "";
      const preSharedKey = spreadsheetPskInput.value ?? "";
      const csvContent = await fetchSpreadsheetCsv(endpoint, preSharedKey);
      const success = await applyCsvContent(csvContent, {
        fileName: "スプレッドシート",
        statusText: "スプレッドシートのデータを使用しています。",
        spreadsheetStatusText: "スプレッドシートからデータを取得しました。",
      });
      if (success) {
        saveSpreadsheetEndpoint(endpoint.trim());
        if (spreadsheetSavePskCheckbox.checked) {
          saveSpreadsheetPsk(preSharedKey.trim());
        } else {
          saveSpreadsheetPsk(null);
        }
      } else {
        setSpreadsheetError("スプレッドシートのデータを反映できませんでした。CSVの形式が不正か、内容が空である可能性があります。");
        setSpreadsheetStatus("データの反映に失敗しました。");
      }
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "スプレッドシートの読み込みに失敗しました。";
      setSpreadsheetError(message);
      setSpreadsheetStatus("スプレッドシートの取得に失敗しました。");
    } finally {
      isFetchingSpreadsheet = false;
    }
  });

  spreadsheetResetButton.addEventListener("click", async () => {
    setSpreadsheetError("");
    saveSpreadsheetEndpoint(null);
    saveSpreadsheetPsk(null);
    resetSpreadsheetDefaults();
    await resetToDefaultCsv();
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
    !yearChartCloseButton ||
    !chartZoomModal ||
    !chartZoomContainer ||
    !chartZoomCloseButton ||
    !chartZoomTitle ||
    !csvFileInput ||
    !csvResetButton ||
    !csvStatus ||
    !csvError ||
    !csvFileName ||
    !csvFileTrigger ||
    !spreadsheetEndpointInput ||
    !spreadsheetFetchButton ||
    !spreadsheetResetButton ||
    !spreadsheetStatus ||
    !spreadsheetError
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
      chartZoomModal: !!chartZoomModal,
      chartZoomContainer: !!chartZoomContainer,
      chartZoomCloseButton: !!chartZoomCloseButton,
      chartZoomTitle: !!chartZoomTitle,
      csvFileInput: !!csvFileInput,
      csvResetButton: !!csvResetButton,
      csvStatus: !!csvStatus,
      csvError: !!csvError,
      csvFileName: !!csvFileName,
      csvFileTrigger: !!csvFileTrigger,
      spreadsheetEndpointInput: !!spreadsheetEndpointInput,
      spreadsheetFetchButton: !!spreadsheetFetchButton,
      spreadsheetResetButton: !!spreadsheetResetButton,
      spreadsheetStatus: !!spreadsheetStatus,
      spreadsheetError: !!spreadsheetError,
    });
    return;
  }

  initYearForm();
  initCsvUpload();
  initSpreadsheetImport();
  initYearChartTrigger();
  initMonthModal();
  initYearChartModal();
  initChartZoomModal();
  const initialYear = Number.parseInt(yearInput.value, 10);
  void loadCalendar(initialYear);
}

document.addEventListener("DOMContentLoaded", init);
