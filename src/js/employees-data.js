const EMPLOYEES_DATA_URL = "../database.json";
const EMPLOYEES_TABLE_SELECTOR = ".table--employees tbody";
const EMPLOYEES_COUNT_SELECTOR = ".table-footer__text";
const EMPLOYEES_PAGE_SIZE_SELECTOR = "#employee-page-size";
const EMPLOYEES_PAGINATION_SELECTOR = ".pagination";
const EMPLOYEES_SORTABLE_HEADERS_SELECTOR = ".table--employees thead th[data-sort-key]";

const EMPLOYEES_FILTER_SELECTORS = {
  position: "#employee-position-filter",
  department: "#employee-department-filter",
  qualification: "#employee-qualification-filter",
  hireDate: "#employee-hire-date-filter",
  taskStatus: "#employee-task-status-filter",
  search: "#employee-search-input",
  submit: "#employee-filter-submit",
  reset: "#employee-filter-reset",
};

const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];

const STATUS_CLASS_MAP = {
  "Виконано": "badge--success",
  "В роботі": "badge--info",
  "На перевірці": "badge--purple",
  "Очікує": "badge--gray",
};

const TASK_STATUS_PRIORITY = {
  "В роботі": 4,
  "На перевірці": 3,
  "Очікує": 2,
  "Виконано": 1,
};

const HIRE_DATE_FILTERS = [
  { label: "За весь час", value: "all" },
  { label: "За 6 місяців", value: "6m" },
  { label: "За 1 рік", value: "1y" },
  { label: "За 2 роки", value: "2y" },
  { label: "За 5 років", value: "5y" },
  { label: "Будь-коли", value: "any" },
];

const DEFAULT_AVATAR = "assets/icons/avatar-user.png";

const employeesTableState = {
  allEmployees: [],
  filteredEmployees: [],
  currentPage: 1,
  pageSize: 10,
  filters: {
    position: "",
    department: "",
    qualification: "",
    hireDate: "all",
    taskStatus: "",
    search: "",
  },
  sort: {
    key: null,
    direction: "desc",
  },
};

function formatDate(dateString) {
  if (!dateString) {
    return "—";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat("uk-UA").format(date);
}

function getStatusClass(status) {
  return STATUS_CLASS_MAP[status] || "badge--gray";
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

function getDateTimestamp(dateString) {
  if (!dateString) {
    return Number.NEGATIVE_INFINITY;
  }

  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? Number.NEGATIVE_INFINITY : date.getTime();
}

function compareValues(valueA, valueB, direction) {
  if (typeof valueA === "string" || typeof valueB === "string") {
    const normalizedA = String(valueA ?? "").toLowerCase();
    const normalizedB = String(valueB ?? "").toLowerCase();
    const result = normalizedA.localeCompare(normalizedB, "uk");

    return direction === "desc" ? -result : result;
  }

  const safeA = Number.isFinite(valueA) ? valueA : Number.NEGATIVE_INFINITY;
  const safeB = Number.isFinite(valueB) ? valueB : Number.NEGATIVE_INFINITY;
  const result = safeA - safeB;

  return direction === "desc" ? -result : result;
}

function getCurrentTaskForEmployee(employeeId, tasks = []) {
  const employeeTasks = tasks.filter((task) => Number(task.employee_id) === Number(employeeId));

  if (!employeeTasks.length) {
    return {
      taskName: "—",
      taskStatus: "Очікує",
    };
  }

  const sortedTasks = [...employeeTasks].sort((taskA, taskB) => {
    const priorityDiff =
      (TASK_STATUS_PRIORITY[taskB.task_status] || 0) - (TASK_STATUS_PRIORITY[taskA.task_status] || 0);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return Number(taskB.task_id || 0) - Number(taskA.task_id || 0);
  });

  return {
    taskName: sortedTasks[0].task_name || "—",
    taskStatus: sortedTasks[0].task_status || "Очікує",
  };
}

function normalizeDirectEmployee(employee, index) {
  return {
    id: employee.id ?? employee.employee_id ?? index + 1,
    name: employee.name ?? employee.full_name ?? "—",
    email: employee.email ?? "—",
    phone: employee.phone ?? employee.phone_number ?? "—",
    position: employee.position ?? "—",
    department: employee.department ?? "—",
    qualification: employee.qualification ?? employee.qualification_level ?? "—",
    hireDate: employee.hire_date ?? employee.hireDate ?? null,
    currentTask: employee.current_task ?? "—",
    taskStatus: employee.task_status ?? "Очікує",
    avatar: employee.avatar ?? DEFAULT_AVATAR,
  };
}

function normalizeRelationalEmployees(database) {
  const users = Array.isArray(database.users) ? database.users : [];
  const employees = Array.isArray(database.employees) ? database.employees : [];
  const tasks = Array.isArray(database.production_tasks) ? database.production_tasks : [];

  const usersById = new Map(users.map((user) => [Number(user.user_id), user]));

  return employees.map((employee, index) => {
    const linkedUser = usersById.get(Number(employee.user_id)) || {};
    const currentTask = getCurrentTaskForEmployee(employee.employee_id, tasks);

    return {
      id: employee.employee_id ?? index + 1,
      name: linkedUser.full_name || "—",
      email: linkedUser.email || "—",
      phone: linkedUser.phone_number || "—",
      position: employee.position || "—",
      department: employee.department || "—",
      qualification: employee.qualification_level || "—",
      hireDate: employee.hire_date || null,
      currentTask: currentTask.taskName,
      taskStatus: currentTask.taskStatus,
      avatar: DEFAULT_AVATAR,
    };
  });
}

function getEmployeesData(database) {
  const directEmployees = Array.isArray(database.employees)
    ? database.employees.filter(
        (employee) => "name" in employee || "current_task" in employee || "task_status" in employee,
      )
    : [];

  if (directEmployees.length > 0) {
    console.log("[employees-data] Using direct employees structure from database.json");
    return directEmployees.map(normalizeDirectEmployee);
  }

  console.log("[employees-data] Using relational employees structure from database.json");
  return normalizeRelationalEmployees(database);
}

function createEmployeeRow(employee) {
  const initials = getInitials(employee.name);
  const badgeClass = getStatusClass(employee.taskStatus);
  const safeAvatar = employee.avatar || DEFAULT_AVATAR;

  return `
    <tr>
      <td>${employee.id}</td>
      <td>
        <div class="user-cell">
          <div class="user-avatar" style="background-image: url('${safeAvatar}');">${initials}</div>
          <div>
            <div class="user-name">${employee.name}</div>
            <div class="user-role">${employee.position}</div>
          </div>
        </div>
      </td>
      <td>${employee.email}</td>
      <td>${employee.phone}</td>
      <td>${employee.position}</td>
      <td>${employee.department}</td>
      <td>${employee.qualification}</td>
      <td>${formatDate(employee.hireDate)}</td>
      <td>${employee.currentTask}</td>
      <td><span class="badge ${badgeClass}">${employee.taskStatus}</span></td>
      <td>
        <button class="icon-button--action icon-button--action--primary" type="button" aria-label="Редагувати">
          <img src="assets/icons/edit.png" alt="" class="icon icon--action">
        </button>
      </td>
    </tr>
  `;
}

function getEmployeeSortValue(employee, sortKey) {
  switch (sortKey) {
    case "id":
      return Number(employee.id) || 0;
    case "name":
      return employee.name || "";
    case "email":
      return employee.email || "";
    default:
      return "";
  }
}

function sortFilteredEmployees() {
  const { key, direction } = employeesTableState.sort;

  if (!key) {
    return;
  }

  employeesTableState.filteredEmployees.sort((employeeA, employeeB) => {
    const valueA = getEmployeeSortValue(employeeA, key);
    const valueB = getEmployeeSortValue(employeeB, key);

    return compareValues(valueA, valueB, direction);
  });
}

function getTotalPages() {
  return Math.max(1, Math.ceil(employeesTableState.filteredEmployees.length / employeesTableState.pageSize));
}

function getVisibleEmployees() {
  const startIndex = (employeesTableState.currentPage - 1) * employeesTableState.pageSize;
  const endIndex = startIndex + employeesTableState.pageSize;

  return employeesTableState.filteredEmployees.slice(startIndex, endIndex);
}

function updateCountLabel(visibleEmployeesCount) {
  const countLabel = document.querySelector(EMPLOYEES_COUNT_SELECTOR);

  if (!countLabel) {
    return;
  }

  if (!employeesTableState.filteredEmployees.length) {
    countLabel.textContent = "Показано 0 із 0 співробітників";
    return;
  }

  const start = (employeesTableState.currentPage - 1) * employeesTableState.pageSize + 1;
  const end = start + visibleEmployeesCount - 1;
  const total = employeesTableState.filteredEmployees.length;

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
  const paginationElement = document.querySelector(EMPLOYEES_PAGINATION_SELECTOR);

  if (!paginationElement) {
    console.error(`[employees-data] Pagination container not found: ${EMPLOYEES_PAGINATION_SELECTOR}`);
    return;
  }

  const totalPages = getTotalPages();
  const currentPage = employeesTableState.currentPage;

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

function renderEmployeesTable() {
  const tableBody = document.querySelector(EMPLOYEES_TABLE_SELECTOR);

  if (!tableBody) {
    console.error(`[employees-data] Table body not found: ${EMPLOYEES_TABLE_SELECTOR}`);
    return;
  }

  const visibleEmployees = getVisibleEmployees();
  tableBody.innerHTML = visibleEmployees.map(createEmployeeRow).join("");

  updateCountLabel(visibleEmployees.length);
  renderPagination();

  console.log(
    `[employees-data] Rendered page ${employeesTableState.currentPage} with ${visibleEmployees.length} employee rows`,
  );
}

function syncPageSizeSelect() {
  const pageSizeSelect = document.querySelector(EMPLOYEES_PAGE_SIZE_SELECTOR);

  if (!pageSizeSelect) {
    console.error(`[employees-data] Page size select not found: ${EMPLOYEES_PAGE_SIZE_SELECTOR}`);
    return;
  }

  pageSizeSelect.value = String(employeesTableState.pageSize);
}

function createOptionsMarkup(defaultLabel, values) {
  const options = values.map((value) => `<option value="${value}">${value}</option>`).join("");
  return `<option value="">${defaultLabel}</option>${options}`;
}

function getUniqueSortedValues(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "uk"));
}

function populateDynamicFilters() {
  const positionSelect = document.querySelector(EMPLOYEES_FILTER_SELECTORS.position);
  const departmentSelect = document.querySelector(EMPLOYEES_FILTER_SELECTORS.department);
  const qualificationSelect = document.querySelector(EMPLOYEES_FILTER_SELECTORS.qualification);
  const taskStatusSelect = document.querySelector(EMPLOYEES_FILTER_SELECTORS.taskStatus);
  const hireDateSelect = document.querySelector(EMPLOYEES_FILTER_SELECTORS.hireDate);

  if (positionSelect) {
    positionSelect.innerHTML = createOptionsMarkup(
      "Всі посади",
      getUniqueSortedValues(employeesTableState.allEmployees, "position"),
    );
  }

  if (departmentSelect) {
    departmentSelect.innerHTML = createOptionsMarkup(
      "Всі відділи",
      getUniqueSortedValues(employeesTableState.allEmployees, "department"),
    );
  }

  if (qualificationSelect) {
    qualificationSelect.innerHTML = createOptionsMarkup(
      "Будь-яка",
      getUniqueSortedValues(employeesTableState.allEmployees, "qualification"),
    );
  }

  if (taskStatusSelect) {
    taskStatusSelect.innerHTML = createOptionsMarkup(
      "Всі статуси",
      getUniqueSortedValues(employeesTableState.allEmployees, "taskStatus"),
    );
  }

  if (hireDateSelect) {
    hireDateSelect.innerHTML = HIRE_DATE_FILTERS.map(
      (option) => `<option value="${option.value}">${option.label}</option>`,
    ).join("");
  }

  console.log("[employees-data] Dynamic filter options populated");
}

function getDateThreshold(filterValue) {
  const threshold = new Date();

  switch (filterValue) {
    case "6m":
      threshold.setMonth(threshold.getMonth() - 6);
      return threshold;
    case "1y":
      threshold.setFullYear(threshold.getFullYear() - 1);
      return threshold;
    case "2y":
      threshold.setFullYear(threshold.getFullYear() - 2);
      return threshold;
    case "5y":
      threshold.setFullYear(threshold.getFullYear() - 5);
      return threshold;
    default:
      return null;
  }
}

function matchesHireDateFilter(employee, hireDateFilter) {
  if (!hireDateFilter || hireDateFilter === "all" || hireDateFilter === "any") {
    return true;
  }

  if (!employee.hireDate) {
    return false;
  }

  const employeeDate = new Date(employee.hireDate);
  const thresholdDate = getDateThreshold(hireDateFilter);

  if (Number.isNaN(employeeDate.getTime()) || !thresholdDate) {
    return false;
  }

  return employeeDate >= thresholdDate;
}

function matchesSearchFilter(employee, searchValue) {
  if (!searchValue) {
    return true;
  }

  const normalizedSearch = searchValue.trim().toLowerCase();
  const normalizedName = employee.name.toLowerCase();
  const normalizedEmail = employee.email.toLowerCase();

  return normalizedName.includes(normalizedSearch) || normalizedEmail.includes(normalizedSearch);
}

function applyFilters() {
  const { position, department, qualification, hireDate, taskStatus, search } = employeesTableState.filters;

  employeesTableState.filteredEmployees = employeesTableState.allEmployees.filter((employee) => {
    const matchesPosition = !position || employee.position === position;
    const matchesDepartment = !department || employee.department === department;
    const matchesQualification = !qualification || employee.qualification === qualification;
    const matchesTaskStatus = !taskStatus || employee.taskStatus === taskStatus;
    const matchesHireDate = matchesHireDateFilter(employee, hireDate);
    const matchesSearch = matchesSearchFilter(employee, search);

    return (
      matchesPosition &&
      matchesDepartment &&
      matchesQualification &&
      matchesTaskStatus &&
      matchesHireDate &&
      matchesSearch
    );
  });

  employeesTableState.currentPage = 1;
  sortFilteredEmployees();

  console.log("[employees-data] Filters applied:", employeesTableState.filters);
  console.log(`[employees-data] ${employeesTableState.filteredEmployees.length} employees matched filters`);

  renderEmployeesTable();
}

function readFiltersFromUI() {
  const positionSelect = document.querySelector(EMPLOYEES_FILTER_SELECTORS.position);
  const departmentSelect = document.querySelector(EMPLOYEES_FILTER_SELECTORS.department);
  const qualificationSelect = document.querySelector(EMPLOYEES_FILTER_SELECTORS.qualification);
  const hireDateSelect = document.querySelector(EMPLOYEES_FILTER_SELECTORS.hireDate);
  const taskStatusSelect = document.querySelector(EMPLOYEES_FILTER_SELECTORS.taskStatus);
  const searchInput = document.querySelector(EMPLOYEES_FILTER_SELECTORS.search);

  employeesTableState.filters = {
    position: positionSelect?.value || "",
    department: departmentSelect?.value || "",
    qualification: qualificationSelect?.value || "",
    hireDate: hireDateSelect?.value || "all",
    taskStatus: taskStatusSelect?.value || "",
    search: searchInput?.value?.trim() || "",
  };
}

function resetFiltersUI() {
  const positionSelect = document.querySelector(EMPLOYEES_FILTER_SELECTORS.position);
  const departmentSelect = document.querySelector(EMPLOYEES_FILTER_SELECTORS.department);
  const qualificationSelect = document.querySelector(EMPLOYEES_FILTER_SELECTORS.qualification);
  const hireDateSelect = document.querySelector(EMPLOYEES_FILTER_SELECTORS.hireDate);
  const taskStatusSelect = document.querySelector(EMPLOYEES_FILTER_SELECTORS.taskStatus);
  const searchInput = document.querySelector(EMPLOYEES_FILTER_SELECTORS.search);

  if (positionSelect) positionSelect.value = "";
  if (departmentSelect) departmentSelect.value = "";
  if (qualificationSelect) qualificationSelect.value = "";
  if (hireDateSelect) hireDateSelect.value = "all";
  if (taskStatusSelect) taskStatusSelect.value = "";
  if (searchInput) searchInput.value = "";
}

function resetFilters() {
  employeesTableState.filters = {
    position: "",
    department: "",
    qualification: "",
    hireDate: "all",
    taskStatus: "",
    search: "",
  };

  resetFiltersUI();
  employeesTableState.filteredEmployees = [...employeesTableState.allEmployees];
  employeesTableState.currentPage = 1;
  sortFilteredEmployees();

  console.log("[employees-data] Filters reset");
  renderEmployeesTable();
}

function handlePageSizeChange(event) {
  const nextPageSize = Number(event.target.value);

  if (!PAGE_SIZE_OPTIONS.includes(nextPageSize)) {
    console.warn(`[employees-data] Unsupported page size: ${event.target.value}`);
    return;
  }

  employeesTableState.pageSize = nextPageSize;
  employeesTableState.currentPage = 1;

  console.log(`[employees-data] Page size changed to ${nextPageSize}`);
  renderEmployeesTable();
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

  employeesTableState.currentPage = nextPage;
  console.log(`[employees-data] Switched to page ${nextPage}`);
  renderEmployeesTable();
}

function handleFilterSubmit() {
  readFiltersFromUI();
  applyFilters();
}

function handleEmployeesSortClick(event) {
  const sortableHeader = event.target.closest("th[data-sort-key]");

  if (!sortableHeader || !sortableHeader.querySelector(".sort-indicator")) {
    return;
  }

  const sortKey = sortableHeader.dataset.sortKey;

  if (employeesTableState.sort.key === sortKey) {
    employeesTableState.sort.direction = employeesTableState.sort.direction === "desc" ? "asc" : "desc";
  } else {
    employeesTableState.sort.key = sortKey;
    employeesTableState.sort.direction = "desc";
  }

  employeesTableState.currentPage = 1;
  sortFilteredEmployees();

  console.log("[employees-data] Sort applied:", employeesTableState.sort);
  renderEmployeesTable();
}

function bindEmployeesTableControls() {
  const pageSizeSelect = document.querySelector(EMPLOYEES_PAGE_SIZE_SELECTOR);
  const paginationElement = document.querySelector(EMPLOYEES_PAGINATION_SELECTOR);
  const filterSubmitButton = document.querySelector(EMPLOYEES_FILTER_SELECTORS.submit);
  const filterResetButton = document.querySelector(EMPLOYEES_FILTER_SELECTORS.reset);
  const sortableHeaders = document.querySelectorAll(EMPLOYEES_SORTABLE_HEADERS_SELECTOR);

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", handlePageSizeChange);
  }

  if (paginationElement) {
    paginationElement.addEventListener("click", handlePaginationClick);
  }

  if (filterSubmitButton) {
    filterSubmitButton.addEventListener("click", handleFilterSubmit);
  }

  if (filterResetButton) {
    filterResetButton.addEventListener("click", resetFilters);
  }

  sortableHeaders.forEach((header) => {
    header.addEventListener("click", handleEmployeesSortClick);
  });
}

async function fetchEmployeesData() {
  console.log("[employees-data] Fetching database.json...");

  const response = await fetch(EMPLOYEES_DATA_URL);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${EMPLOYEES_DATA_URL}`);
  }

  const json = await response.json();
  const database = Object.create(json);

  console.log("[employees-data] Data is ready:", database);

  return database;
}

async function initEmployeesTable() {
  try {
    const database = await fetchEmployeesData();
    const employees = getEmployeesData(database);

    employeesTableState.allEmployees = employees;
    employeesTableState.filteredEmployees = [...employees];

    if (!employees.length) {
      console.warn("[employees-data] No employees found in database.json");
    }

    populateDynamicFilters();
    bindEmployeesTableControls();
    syncPageSizeSelect();
    renderEmployeesTable();
  } catch (error) {
    console.error("[employees-data] Error fetching data:", error);
  }
}

document.addEventListener("DOMContentLoaded", initEmployeesTable);
