const PRODUCTION_TASKS_DATA_URL = "../database.json";
const PRODUCTION_TASKS_TABLE_SELECTOR = ".table--production-tasks tbody";
const PRODUCTION_TASKS_COUNT_SELECTOR = ".table-footer__text";
const PRODUCTION_TASKS_PAGE_SIZE_SELECTOR = ".footer-select select";
const PRODUCTION_TASKS_PAGINATION_SELECTOR = ".pagination";

const PRODUCTION_TASK_STATUS_CLASS_MAP = {
  "Виконано": "badge--success",
  "В роботі": "badge--info",
  "На перевірці": "badge--purple",
  "Очікує": "badge--gray",
};

const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];

const productionTasksTableState = {
  allTasks: [],
  currentPage: 1,
  pageSize: 10,
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

function formatDateTime(dateString) {
  if (!dateString) {
    return "—";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  const datePart = new Intl.DateTimeFormat("uk-UA").format(date);
  const timePart = new Intl.DateTimeFormat("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  return `${timePart} · ${datePart}`;
}

function getBadgeClass(status) {
  return PRODUCTION_TASK_STATUS_CLASS_MAP[status] || "badge--gray";
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

function normalizeDirectTask(task, index) {
  return {
    id: task.id ?? task.task_id ?? index + 1,
    name: task.task_name ?? "—",
    orderName: task.order_name ?? "—",
    plannedDate: task.planned_date ?? task.planned_completion_date ?? null,
    actualDate: task.actual_date ?? task.actual_completion_date ?? null,
    employeeName: task.employee ?? task.employee_name ?? "—",
    employeeRole: task.employee_role ?? "—",
    description: task.description ?? "—",
    status: task.status ?? task.task_status ?? "Очікує",
  };
}

function normalizeRelationalTasks(database) {
  const tasks = Array.isArray(database.production_tasks) ? database.production_tasks : [];
  const orders = Array.isArray(database.orders) ? database.orders : [];
  const employees = Array.isArray(database.employees) ? database.employees : [];
  const users = Array.isArray(database.users) ? database.users : [];

  const ordersById = new Map(orders.map((order) => [Number(order.order_id), order]));
  const usersById = new Map(users.map((user) => [Number(user.user_id), user]));
  const employeesById = new Map(
    employees.map((employee) => {
      const linkedUser = usersById.get(Number(employee.user_id)) || {};

      return [
        Number(employee.employee_id),
        {
          name: linkedUser.full_name || "—",
          role: employee.position || "—",
        },
      ];
    }),
  );

  return tasks.map((task, index) => {
    const linkedOrder = ordersById.get(Number(task.order_id)) || {};
    const linkedEmployee = employeesById.get(Number(task.employee_id)) || {};

    return {
      id: task.task_id ?? index + 1,
      name: task.task_name || "—",
      orderName: linkedOrder.order_name || "—",
      plannedDate: task.planned_completion_date || null,
      actualDate: task.actual_completion_date || null,
      employeeName: linkedEmployee.name || "—",
      employeeRole: linkedEmployee.role || "—",
      description: task.description || "—",
      status: task.task_status || "Очікує",
    };
  });
}

function getProductionTasksData(database) {
  const directTasks = Array.isArray(database.production_tasks)
    ? database.production_tasks.filter((task) => "order_name" in task || "employee" in task || "status" in task)
    : [];

  if (directTasks.length > 0) {
    console.log("[production-tasks-data] Using direct production_tasks structure from database.json");
    return directTasks.map(normalizeDirectTask);
  }

  console.log("[production-tasks-data] Using relational production_tasks structure from database.json");
  return normalizeRelationalTasks(database);
}

function createActionsCell() {
  return `
    <button class="icon-button--action icon-button--action--primary" type="button" aria-label="Редагувати">
      <img src="assets/icons/edit.png" alt="" class="icon icon--action">
    </button>
    <button class="icon-button--action icon-button--action--secondary" type="button" aria-label="Переглянути">
      <img src="assets/icons/view.svg" alt="" class="icon icon--action">
    </button>
  `;
}

function createEmployeeCell(task) {
  return `
    <div class="user-cell">
      <div class="user-avatar">${getInitials(task.employeeName)}</div>
      <div>
        <div class="user-name">${task.employeeName}</div>
        <div class="user-role">${task.employeeRole}</div>
      </div>
    </div>
  `;
}

function createTaskRow(task) {
  return `
    <tr>
      <td>${task.id}</td>
      <td>${task.name}</td>
      <td>${task.orderName}</td>
      <td>${formatDate(task.plannedDate)}</td>
      <td>${formatDateTime(task.actualDate)}</td>
      <td>${createEmployeeCell(task)}</td>
      <td>${task.description}</td>
      <td><span class="badge ${getBadgeClass(task.status)}">${task.status}</span></td>
      <td>${createActionsCell()}</td>
    </tr>
  `;
}

function getTotalPages() {
  return Math.max(1, Math.ceil(productionTasksTableState.allTasks.length / productionTasksTableState.pageSize));
}

function getVisibleTasks() {
  const startIndex = (productionTasksTableState.currentPage - 1) * productionTasksTableState.pageSize;
  const endIndex = startIndex + productionTasksTableState.pageSize;

  return productionTasksTableState.allTasks.slice(startIndex, endIndex);
}

function updateCountLabel(visibleTasksCount) {
  const countLabel = document.querySelector(PRODUCTION_TASKS_COUNT_SELECTOR);

  if (!countLabel) {
    return;
  }

  if (!productionTasksTableState.allTasks.length) {
    countLabel.textContent = "Показано 0 із 0 виробничих задач";
    return;
  }

  const start = (productionTasksTableState.currentPage - 1) * productionTasksTableState.pageSize + 1;
  const end = start + visibleTasksCount - 1;
  const total = productionTasksTableState.allTasks.length;

  countLabel.textContent = `Показано ${start}–${end} із ${total} виробничих задач`;
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
  const paginationElement = document.querySelector(PRODUCTION_TASKS_PAGINATION_SELECTOR);

  if (!paginationElement) {
    console.error(`[production-tasks-data] Pagination container not found: ${PRODUCTION_TASKS_PAGINATION_SELECTOR}`);
    return;
  }

  const totalPages = getTotalPages();
  const currentPage = productionTasksTableState.currentPage;

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

function renderProductionTasksTable() {
  const tableBody = document.querySelector(PRODUCTION_TASKS_TABLE_SELECTOR);

  if (!tableBody) {
    console.error(`[production-tasks-data] Table body not found: ${PRODUCTION_TASKS_TABLE_SELECTOR}`);
    return;
  }

  const visibleTasks = getVisibleTasks();
  tableBody.innerHTML = visibleTasks.map(createTaskRow).join("");

  updateCountLabel(visibleTasks.length);
  renderPagination();

  console.log(
    `[production-tasks-data] Rendered page ${productionTasksTableState.currentPage} with ${visibleTasks.length} production task rows`,
  );
}

function syncPageSizeSelect() {
  const pageSizeSelect = document.querySelector(PRODUCTION_TASKS_PAGE_SIZE_SELECTOR);

  if (!pageSizeSelect) {
    console.error(`[production-tasks-data] Page size select not found: ${PRODUCTION_TASKS_PAGE_SIZE_SELECTOR}`);
    return;
  }

  pageSizeSelect.value = String(productionTasksTableState.pageSize);
}

function handlePageSizeChange(event) {
  const nextPageSize = Number(event.target.value);

  if (!PAGE_SIZE_OPTIONS.includes(nextPageSize)) {
    console.warn(`[production-tasks-data] Unsupported page size: ${event.target.value}`);
    return;
  }

  productionTasksTableState.pageSize = nextPageSize;
  productionTasksTableState.currentPage = 1;

  console.log(`[production-tasks-data] Page size changed to ${nextPageSize}`);
  renderProductionTasksTable();
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

  productionTasksTableState.currentPage = nextPage;

  console.log(`[production-tasks-data] Switched to page ${nextPage}`);
  renderProductionTasksTable();
}

function bindProductionTasksTableControls() {
  const pageSizeSelect = document.querySelector(PRODUCTION_TASKS_PAGE_SIZE_SELECTOR);
  const paginationElement = document.querySelector(PRODUCTION_TASKS_PAGINATION_SELECTOR);

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", handlePageSizeChange);
  }

  if (paginationElement) {
    paginationElement.addEventListener("click", handlePaginationClick);
  }
}

async function fetchProductionTasksData() {
  console.log("[production-tasks-data] Fetching database.json...");

  const response = await fetch(PRODUCTION_TASKS_DATA_URL);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${PRODUCTION_TASKS_DATA_URL}`);
  }

  const json = await response.json();
  const database = Object.create(json);

  console.log("[production-tasks-data] Data is ready:", database);

  return database;
}

async function initProductionTasksTable() {
  try {
    const database = await fetchProductionTasksData();
    const tasks = getProductionTasksData(database);

    productionTasksTableState.allTasks = tasks;

    if (!tasks.length) {
      console.warn("[production-tasks-data] No production tasks found in database.json");
    }

    bindProductionTasksTableControls();
    syncPageSizeSelect();
    renderProductionTasksTable();
  } catch (error) {
    console.error("[production-tasks-data] Error fetching data:", error);
  }
}

document.addEventListener("DOMContentLoaded", initProductionTasksTable);
