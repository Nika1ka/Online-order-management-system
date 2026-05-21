const PRODUCTION_TASKS_DATA_URL = "../database.json";
const PRODUCTION_TASKS_TABLE_SELECTOR = ".table--production-tasks tbody";

const PRODUCTION_TASK_STATUS_CLASS_MAP = {
  "Виконано": "badge--success",
  "В роботі": "badge--info",
  "На перевірці": "badge--purple",
  "Очікує": "badge--gray",
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

function renderProductionTasksTable(tasks) {
  const tableBody = document.querySelector(PRODUCTION_TASKS_TABLE_SELECTOR);

  if (!tableBody) {
    console.error(`[production-tasks-data] Table body not found: ${PRODUCTION_TASKS_TABLE_SELECTOR}`);
    return;
  }

  tableBody.innerHTML = tasks.map(createTaskRow).join("");

  console.log(`[production-tasks-data] Rendered ${tasks.length} production task rows`);
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

    if (!tasks.length) {
      console.warn("[production-tasks-data] No production tasks found in database.json");
    }

    renderProductionTasksTable(tasks);
  } catch (error) {
    console.error("[production-tasks-data] Error fetching data:", error);
  }
}

document.addEventListener("DOMContentLoaded", initProductionTasksTable);
