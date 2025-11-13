const UPLOAD_ENDPOINTS = ["/api/calendar/upload", "/api/calendar"];

async function readCalendarResponse(response) {
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
        // parse failure fallback to plain text
      }
      errorMessage += `: ${errorDetail}`;
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

async function postCalendarWithCsv(year, csvContent) {
  let lastError = null;
  const fallbackErrorMessage =
    "CSVアップロードAPIを呼び出せませんでした。サーバーを最新のコードで再起動してください。";

  for (const endpoint of UPLOAD_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ year, csvContent }),
      });

      if (!response.ok) {
        let errorMessage = `${endpoint} の呼び出しに失敗しました (${response.status})`;
        const bodyText = await response.text().catch(() => "");
        if (bodyText) {
          errorMessage += `: ${bodyText}`;
        }
        lastError = new Error(errorMessage);
        continue;
      }

      return readCalendarResponse(response);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      continue;
    }
  }

  throw lastError ?? new Error(fallbackErrorMessage);
}

async function getCalendar(year, options = {}) {
  const params = new URLSearchParams({ year: String(year) });
  if (options.csvPath) {
    params.set("csvPath", options.csvPath);
  }
  const response = await fetch(`/api/calendar?${params.toString()}`);
  return readCalendarResponse(response);
}

export async function fetchCalendarData(year, options = {}) {
  if (options.csvContent) {
    return postCalendarWithCsv(year, options.csvContent);
  }
  return getCalendar(year, options);
}
