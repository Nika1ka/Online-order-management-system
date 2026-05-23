const EMPLOYEE_PERFORMANCE_DATA_URL = "../database.json";
const EMPLOYEE_PERFORMANCE_TABLE_SELECTOR = ".table--analytics tbody";
const EMPLOYEE_PERFORMANCE_COUNT_SELECTOR = ".table-footer__text";
const EMPLOYEE_PERFORMANCE_PAGE_SIZE_SELECTOR = "#employee-performance-page-size";
const EMPLOYEE_PERFORMANCE_PAGINATION_SELECTOR = ".pagination";
const TASK_TIME_NORM_HOURS = 100;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

const EMPLOYEE_PERFORMANCE_FILTER_SELECTORS = {
  startDate: "#production-task-planned-date-from",
  position: "#employee-performance-position-filter",
  department: "#employee-performance-department-filter",
  time: "#employee-performance-time-filter",
  search: "#employee-performance-search-input",
  submit: "#employee-performance-filter-submit",
  reset: "#employee-performance-filter-reset",
};

const employeePerformanceState = {
  allEmployees: [],
  filteredEmployees: [],
  currentPage: 1,
  pageSize: 5,
  filters: {
    startDate: "",
    position: "",
    department: "",
    time: "30d",
    search: "",
  },
};

function createOptionsMarkup(defaultLabel, values) {
  const options = values.map((value) => `<option value="${value}">${value}</option>`).join("");
  return `<option value="">${defaultLabel}</option>${options}`;
}

function getUniqueSortedValues(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "uk"));
}

function getInitials(fullName) {
  if (!fullName) {
    return "??";
  }

  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function formatHours(hours) {
  if (!Number.isFinite(hours)) {
    return "—";
  }

  return `${hours.toFixed(1)} год.`;
}

function getProgressClass(score) {
  if (score >= 80) {
    return "progress-inline--success";
  }

  if (score >= 60) {
    return "progress-inline--info";
  }

  if (score >= 40) {
    return "progress-inline--purple";
  }

  return "progress-inline--red";
}

function getDurationDays(periodValue) {
  switch (periodValue) {
    case "7d":
      return 7;
    case "90d":
      return 90;
    case "180d":
      return 180;
    case "365d":
      return 365;
    case "30d":
    default:
      return 30;
  }
}

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDefaultStartDateValue(periodValue = "30d") {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return formatDateInputValue(today);
}

function getPeriodRange(startDateValue, periodValue) {
  const rangeStart = parseDate(startDateValue) || parseDate(getDefaultStartDateValue(periodValue));
  const rangeEnd = new Date(rangeStart);

  rangeStart.setHours(0, 0, 0, 0);
  rangeEnd.setHours(23, 59, 59, 999);
  rangeEnd.setDate(rangeEnd.getDate() + getDurationDays(periodValue));

  return { rangeStart, rangeEnd };
}

function parseDate(dateString) {
  if (!dateString) {
    return null;
  }

  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getTaskReferenceDate(task) {
  return parseDate(task.start_date) || parseDate(task.actual_completion_date) || parseDate(task.planned_completion_date);
}

function isTaskInPeriod(task, startDateValue, periodValue) {
  const referenceDate = getTaskReferenceDate(task);

  if (!referenceDate) {
    return false;
  }

  const { rangeStart, rangeEnd } = getPeriodRange(startDateValue, periodValue);

  return referenceDate >= rangeStart && referenceDate <= rangeEnd;
}

function normalizeDatabase(database) {
  const users = Array.isArray(database.users) ? database.users : [];
  const employees = Array.isArray(database.employees) ? database.employees : [];
  const tasks = Array.isArray(database.production_tasks) ? database.production_tasks : [];
  const taskResults = Array.isArray(database.task_results) ? database.task_results : [];

  const usersById = new Map(users.map((user) => [Number(user.user_id), user]));
  const tasksByEmployeeId = new Map();
  const taskResultsByTaskId = new Map(taskResults.map((result) => [Number(result.task_id), result]));

  tasks.forEach((task) => {
    const employeeId = Number(task.employee_id);

    if (!tasksByEmployeeId.has(employeeId)) {
      tasksByEmployeeId.set(employeeId, []);
    }

    tasksByEmployeeId.get(employeeId).push(task);
  });

  return employees.map((employee) => {
    const linkedUser = usersById.get(Number(employee.user_id)) || {};

    return {
      id: employee.employee_id,
      name: linkedUser.full_name || "—",
      email: linkedUser.email || "",
      position: employee.position || "—",
      department: employee.department || "—",
      tasks: tasksByEmployeeId.get(Number(employee.employee_id)) || [],
      taskResultsByTaskId,
    };
  });
}

function calculateEmployeeMetrics(employee, startDateValue, periodValue) {
  const periodTasks = employee.tasks.filter((task) => isTaskInPeriod(task, startDateValue, periodValue));
  const completedOnTime = periodTasks.filter((task) => {
    const plannedDate = parseDate(task.planned_completion_date);
    const actualDate = parseDate(task.actual_completion_date);

    return plannedDate && actualDate && plannedDate >= actualDate;
  }).length;

  const overdue = periodTasks.filter((task) => {
    const plannedDate = parseDate(task.planned_completion_date);
    const actualDate = parseDate(task.actual_completion_date);

    return plannedDate && actualDate && plannedDate < actualDate;
  }).length;

  const executionTimes = periodTasks
    .map((task) => {
      const startDate = parseDate(task.start_date);
      const actualDate = parseDate(task.actual_completion_date);

      if (!startDate || !actualDate) {
        return null;
      }

      return (actualDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    })
    .filter((value) => Number.isFinite(value));

  const averageExecutionHours = executionTimes.length
    ? executionTimes.reduce((sum, value) => sum + value, 0) / executionTimes.length
    : null;

  const productivityScore = averageExecutionHours === null
    ? 0
    : Math.max(0, Math.min(100, Math.round((TASK_TIME_NORM_HOURS / averageExecutionHours) * 100)));

  return {
    ...employee,
    periodTasks,
    completedOnTime,
    overdue,
    averageExecutionHours,
    productivityScore,
  };
}

function createEmployeePerformanceRow(employee) {
  total_productivity_score = employee.productivityScore*(employee.completedOnTime/(employee.completedOnTime + employee.overdue)) || 0;
  const progressClass = getProgressClass(total_productivity_score);
  const initials = getInitials(employee.name);

  return `
    <tr>
      <td>${employee.id}</td>
      <td>
        <div class="user-cell">
          <div class="user-avatar">${initials}</div>
          <div>
            <div class="user-name">${employee.name}</div>
            <div class="user-role">${employee.position}</div>
          </div>
        </div>
      </td>
      <td>${employee.position}</td>
      <td>${employee.department}</td>
      <td>
        <div class="progress-inline ${progressClass}">
          <div class="progress-inline__bar" style="width: ${total_productivity_score}%"></div>
        </div>
      </td>
      <td>
        <div class="dashboard-card__metric">
          <span class="dashboard-card__metric-value">${employee.completedOnTime}</span>
          <span class="dashboard-card__metric-icon"><img src="assets/icons/check.svg" alt="" class="icon icon--metric"></span>
          <span class="dashboard-card__metric-value">${employee.overdue}</span>
          <span class="dashboard-card__metric-icon"><img src="assets/icons/close.svg" alt="" class="icon icon--metric"></span>
        </div>
      </td>
      <td>${formatHours(employee.averageExecutionHours)}</td>
      <td>
        <button class="icon-button icon-button--small" type="button" aria-label="ШІ-аналіз">
          <img src="assets/icons/ai.png" alt="" class="icon icon--action">
        </button>
      </td>
    </tr>
  `;
}

function getTotalPages() {
  return Math.max(1, Math.ceil(employeePerformanceState.filteredEmployees.length / employeePerformanceState.pageSize));
}

function getVisibleEmployees() {
  const startIndex = (employeePerformanceState.currentPage - 1) * employeePerformanceState.pageSize;
  const endIndex = startIndex + employeePerformanceState.pageSize;

  return employeePerformanceState.filteredEmployees.slice(startIndex, endIndex);
}

function updateCountLabel(visibleEmployeesCount) {
  const countLabel = document.querySelector(EMPLOYEE_PERFORMANCE_COUNT_SELECTOR);

  if (!countLabel) {
    return;
  }

  if (!employeePerformanceState.filteredEmployees.length) {
    countLabel.textContent = "Показано 0 із 0 співробітників";
    return;
  }

  const start = (employeePerformanceState.currentPage - 1) * employeePerformanceState.pageSize + 1;
  const end = start + visibleEmployeesCount - 1;
  const total = employeePerformanceState.filteredEmployees.length;

  countLabel.textContent = `Показано ${start}–${end} із ${total} співробітників`;
}

function createPaginationButton({ label, page, disabled = false, active = false, type = "page" }) {
  const activeClass = active ? " button--active" : "";
  const disabledAttr = disabled ? " disabled" : "";
  const ariaCurrent = active ? ' aria-current="page"' : "";

  return `
    <button
      class="button button--ghost${activeClass}"
      type="button"
      data-page-type="${type}"
      data-page="${page}"
      ${disabledAttr}${ariaCurrent}
    >
      ${label}
    </button>
  `;
}

function renderPagination() {
  const paginationElement = document.querySelector(EMPLOYEE_PERFORMANCE_PAGINATION_SELECTOR);

  if (!paginationElement) {
    return;
  }

  const totalPages = getTotalPages();
  const currentPage = employeePerformanceState.currentPage;

  const pageButtons = Array.from({ length: totalPages }, (_, index) =>
    createPaginationButton({
      label: index + 1,
      page: index + 1,
      active: currentPage === index + 1,
    }),
  ).join("");

  paginationElement.innerHTML = `
    ${createPaginationButton({
      label: "Попередня",
      page: currentPage - 1,
      disabled: currentPage === 1,
      type: "prev",
    })}
    ${pageButtons}
    ${createPaginationButton({
      label: "Наступна",
      page: currentPage + 1,
      disabled: currentPage === totalPages,
      type: "next",
    })}
  `;
}

function renderEmployeePerformanceTable() {
  const tableBody = document.querySelector(EMPLOYEE_PERFORMANCE_TABLE_SELECTOR);

  if (!tableBody) {
    console.error(`[employee-performance] Table body not found: ${EMPLOYEE_PERFORMANCE_TABLE_SELECTOR}`);
    return;
  }

  const visibleEmployees = getVisibleEmployees();
  tableBody.innerHTML = visibleEmployees.map(createEmployeePerformanceRow).join("");

  updateCountLabel(visibleEmployees.length);
  renderPagination();

  console.log(
    `[employee-performance] Rendered page ${employeePerformanceState.currentPage} with ${visibleEmployees.length} employee rows`,
  );
}

function syncPageSizeSelect() {
  const pageSizeSelect = document.querySelector(EMPLOYEE_PERFORMANCE_PAGE_SIZE_SELECTOR);
  const startDateInput = document.querySelector(EMPLOYEE_PERFORMANCE_FILTER_SELECTORS.startDate);

  if (!pageSizeSelect) {
    return;
  }

  pageSizeSelect.value = String(employeePerformanceState.pageSize);

  if (startDateInput && !startDateInput.value) {
    startDateInput.value = employeePerformanceState.filters.startDate || getDefaultStartDateValue(employeePerformanceState.filters.time);
  }
}

function readFiltersFromUI() {
  employeePerformanceState.filters = {
    startDate: document.querySelector(EMPLOYEE_PERFORMANCE_FILTER_SELECTORS.startDate)?.value || getDefaultStartDateValue(document.querySelector(EMPLOYEE_PERFORMANCE_FILTER_SELECTORS.time)?.value || "30d"),
    position: document.querySelector(EMPLOYEE_PERFORMANCE_FILTER_SELECTORS.position)?.value || "",
    department: document.querySelector(EMPLOYEE_PERFORMANCE_FILTER_SELECTORS.department)?.value || "",
    time: document.querySelector(EMPLOYEE_PERFORMANCE_FILTER_SELECTORS.time)?.value || "30d",
    search: document.querySelector(EMPLOYEE_PERFORMANCE_FILTER_SELECTORS.search)?.value?.trim() || "",
  };
}

function matchesSearch(employee, searchValue) {
  if (!searchValue) {
    return true;
  }

  const normalizedSearch = searchValue.toLowerCase();

  return (
    employee.name.toLowerCase().includes(normalizedSearch) ||
    employee.email.toLowerCase().includes(normalizedSearch)
  );
}

function applyFilters() {
  const { startDate, position, department, time, search } = employeePerformanceState.filters;

  employeePerformanceState.filteredEmployees = employeePerformanceState.allEmployees
    .filter((employee) => {
      const matchesPosition = !position || employee.position === position;
      const matchesDepartment = !department || employee.department === department;
      const matchesEmployeeSearch = matchesSearch(employee, search);

      return matchesPosition && matchesDepartment && matchesEmployeeSearch;
    })
    .map((employee) => calculateEmployeeMetrics(employee, startDate, time))
    .sort((employeeA, employeeB) => {
      if (employeeB.productivityScore !== employeeA.productivityScore) {
        return employeeB.productivityScore - employeeA.productivityScore;
      }

      if (employeeB.completedOnTime !== employeeA.completedOnTime) {
        return employeeB.completedOnTime - employeeA.completedOnTime;
      }

      return employeeA.name.localeCompare(employeeB.name, "uk");
    });

  employeePerformanceState.currentPage = 1;

  console.log("[employee-performance] Filters applied:", employeePerformanceState.filters);
  console.log(`[employee-performance] ${employeePerformanceState.filteredEmployees.length} employees matched filters`);

  renderEmployeePerformanceTable();
}

function resetFiltersUI() {
  const startDateInput = document.querySelector(EMPLOYEE_PERFORMANCE_FILTER_SELECTORS.startDate);
  const positionSelect = document.querySelector(EMPLOYEE_PERFORMANCE_FILTER_SELECTORS.position);
  const departmentSelect = document.querySelector(EMPLOYEE_PERFORMANCE_FILTER_SELECTORS.department);
  const timeSelect = document.querySelector(EMPLOYEE_PERFORMANCE_FILTER_SELECTORS.time);
  const searchInput = document.querySelector(EMPLOYEE_PERFORMANCE_FILTER_SELECTORS.search);

  if (startDateInput) startDateInput.value = getDefaultStartDateValue("30d");
  if (positionSelect) positionSelect.value = "";
  if (departmentSelect) departmentSelect.value = "";
  if (timeSelect) timeSelect.value = "30d";
  if (searchInput) searchInput.value = "";
}

function resetFilters() {
  employeePerformanceState.filters = {
    startDate: getDefaultStartDateValue("30d"),
    position: "",
    department: "",
    time: "30d",
    search: "",
  };

  resetFiltersUI();
  applyFilters();
}

function populateEmployeePerformanceFilters(employees) {
  const positionSelect = document.querySelector(EMPLOYEE_PERFORMANCE_FILTER_SELECTORS.position);
  const departmentSelect = document.querySelector(EMPLOYEE_PERFORMANCE_FILTER_SELECTORS.department);

  if (positionSelect) {
    positionSelect.innerHTML = createOptionsMarkup("Всі посади", getUniqueSortedValues(employees, "position"));
  }

  if (departmentSelect) {
    departmentSelect.innerHTML = createOptionsMarkup("Всі відділи", getUniqueSortedValues(employees, "department"));
  }

  console.log("[employee-performance] Position and department filters populated");
}

function handlePageSizeChange(event) {
  const nextPageSize = Number(event.target.value);

  if (!PAGE_SIZE_OPTIONS.includes(nextPageSize)) {
    return;
  }

  employeePerformanceState.pageSize = nextPageSize;
  employeePerformanceState.currentPage = 1;
  renderEmployeePerformanceTable();
}

function handlePaginationClick(event) {
  const button = event.target.closest("[data-page]");

  if (!button || button.disabled) {
    return;
  }

  const nextPage = Number(button.dataset.page);
  const totalPages = getTotalPages();

  if (Number.isNaN(nextPage) || nextPage < 1 || nextPage > totalPages) {
    return;
  }

  employeePerformanceState.currentPage = nextPage;
  renderEmployeePerformanceTable();
}

function bindEmployeePerformanceControls() {
  const pageSizeSelect = document.querySelector(EMPLOYEE_PERFORMANCE_PAGE_SIZE_SELECTOR);
  const paginationElement = document.querySelector(EMPLOYEE_PERFORMANCE_PAGINATION_SELECTOR);
  const filterSubmitButton = document.querySelector(EMPLOYEE_PERFORMANCE_FILTER_SELECTORS.submit);
  const filterResetButton = document.querySelector(EMPLOYEE_PERFORMANCE_FILTER_SELECTORS.reset);

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", handlePageSizeChange);
  }

  if (paginationElement) {
    paginationElement.addEventListener("click", handlePaginationClick);
  }

  if (filterSubmitButton) {
    filterSubmitButton.addEventListener("click", () => {
      readFiltersFromUI();
      applyFilters();
    });
  }

  if (filterResetButton) {
    filterResetButton.addEventListener("click", resetFilters);
  }
}

async function fetchEmployeePerformanceData() {
  console.log("[employee-performance] Fetching database.json...");

  const response = await fetch(EMPLOYEE_PERFORMANCE_DATA_URL);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${EMPLOYEE_PERFORMANCE_DATA_URL}`);
  }

  const json = await response.json();
  const database = Object.create(json);

  console.log("[employee-performance] Data is ready:", database);

  return database;
}

async function initEmployeePerformancePage() {
  try {
    const database = await fetchEmployeePerformanceData();
    const employees = normalizeDatabase(database);

    employeePerformanceState.allEmployees = employees;
    employeePerformanceState.filters.startDate = getDefaultStartDateValue(employeePerformanceState.filters.time);

    if (!employees.length) {
      console.warn("[employee-performance] No employees found in database.json");
    }

    populateEmployeePerformanceFilters(employees);
    bindEmployeePerformanceControls();
    syncPageSizeSelect();
    applyFilters();
  } catch (error) {
    console.error("[employee-performance] Error fetching data:", error);
  }
}

document.addEventListener("DOMContentLoaded", initEmployeePerformancePage);
