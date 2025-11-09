const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

const calendarElement = document.getElementById("calendar");
const yearForm = document.getElementById("yearForm");
const yearInput = document.getElementById("yearInput");
const monthTemplate = document.getElementById("monthTemplate");

function createWeekdayHeaderRow() {
  const fragment = document.createDocumentFragment();
  WEEKDAY_LABELS.forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    fragment.appendChild(th);
  });
  return fragment;
}

function renderWeeks(tbody, weeks) {
  weeks.forEach((week) => {
    const tr = document.createElement("tr");
    week.forEach((day) => {
      const td = document.createElement("td");
      if (day === null) {
        td.classList.add("empty");
      } else {
        td.textContent = String(day.day);
        if (day.isToday) {
          td.classList.add("today");
        }
        td.setAttribute("data-date", day.isoDate);
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

function renderCalendar(calendar) {
  calendarElement.innerHTML = "";
  const weekdayHeader = createWeekdayHeaderRow();

  calendar.months.forEach((month) => {
    const monthNode = monthTemplate.content.firstElementChild.cloneNode(true);
    const header = monthNode.querySelector(".month-header");
    const weekdayRow = monthNode.querySelector(".weekday-row");
    const weeksBody = monthNode.querySelector(".weeks");

    header.textContent = month.title;
    weekdayRow.appendChild(weekdayHeader.cloneNode(true));
    renderWeeks(weeksBody, month.weeks);

    calendarElement.appendChild(monthNode);
  });
}

async function fetchCalendar(year) {
  const response = await fetch(`/api/calendar?year=${encodeURIComponent(year)}`);
  if (!response.ok) {
    throw new Error("カレンダーを取得できませんでした");
  }
  return response.json();
}

async function loadCalendar(year) {
  try {
    const calendar = await fetchCalendar(year);
    renderCalendar(calendar);
  } catch (error) {
    console.error(error);
    calendarElement.innerHTML = `<p class="error">カレンダーを読み込めませんでした。</p>`;
  }
}

function initYearForm() {
  const currentYear = new Date().getFullYear();
  yearInput.value = String(currentYear);

  yearForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const year = Number.parseInt(yearInput.value, 10);
    if (Number.isNaN(year) || year <= 0) {
      alert("年の指定が不正です");
      return;
    }
    loadCalendar(year);
  });
}

function init() {
  if (!calendarElement || !yearForm || !yearInput || !monthTemplate) {
    console.error("必要なUI要素が見つかりませんでした。");
    return;
  }

  initYearForm();
  const initialYear = Number.parseInt(yearInput.value, 10);
  void loadCalendar(initialYear);
}

document.addEventListener("DOMContentLoaded", init);
