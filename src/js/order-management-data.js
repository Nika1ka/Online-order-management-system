const ORDER_MANAGEMENT_DATA_URL = "../database.json";
const ORDERS_TABLE_SELECTOR = ".table--orders tbody";

const ORDER_STATUS_CLASS_MAP = {
  "Виконано": "badge--success",
  "В роботі": "badge--info",
  "На перевірці": "badge--purple",
  "Очікує": "badge--gray",
  "Прострочено": "badge--purple",
};

const ORDER_PRIORITY_CLASS_MAP = {
  "Високий": "badge--purple",
  "Середній": "badge--info",
  "Низький": "badge--gray",
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

function getBadgeClass(status, classMap) {
  return classMap[status] || "badge--gray";
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

function formatBudget(amount) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return "—";
  }

  return `${new Intl.NumberFormat("uk-UA").format(numericAmount)} грн`;
}

function getOrdersTableMode() {
  const headers = [...document.querySelectorAll(".table--orders thead th")].map((header) =>
    header.textContent.replace(/\s+/g, " ").trim(),
  );

  const hasPriorityColumn = headers.some((headerText) => headerText.includes("Пріоритет"));
  const hasBudgetColumn = headers.some((headerText) => headerText.includes("Бюджет"));

  return hasPriorityColumn && hasBudgetColumn ? "detailed" : "progress";
}

function getOrderPriority(order) {
  if (order.priority) {
    return order.priority;
  }

  if (order.status === "Виконано") {
    return "Низький";
  }

  const deadline = new Date(order.deadline);

  if (Number.isNaN(deadline.getTime())) {
    return "Середній";
  }

  const today = new Date();
  const daysToDeadline = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysToDeadline < 0 || daysToDeadline <= 14) {
    return "Високий";
  }

  if (daysToDeadline <= 45) {
    return "Середній";
  }

  return "Низький";
}

function getOrderBudget(order, totalTasks) {
  if (order.budget) {
    return Number(order.budget);
  }

  return 45000 + totalTasks * 8500;
}

function getOrderManager(orderId, tasks, employeesById) {
  const orderTasks = tasks.filter((task) => Number(task.order_id) === Number(orderId));

  if (!orderTasks.length) {
    return "—";
  }

  const managerTask = orderTasks.find((task) => {
    const employee = employeesById.get(Number(task.employee_id));
    return employee?.position?.toLowerCase().includes("менеджер");
  });

  const selectedTask = managerTask || orderTasks[0];
  const employee = employeesById.get(Number(selectedTask.employee_id));

  return employee?.name || "—";
}

function normalizeDirectOrder(order, index) {
  return {
    id: order.id ?? order.order_id ?? index + 1,
    name: order.order_name ?? "—",
    client: order.client ?? order.client_name ?? "—",
    status: order.status ?? order.order_status ?? "Очікує",
    priority: order.priority ?? "Середній",
    createdAt: order.created_at ?? null,
    deadline: order.deadline ?? order.planned_completion_date ?? null,
    actualDate: order.actual_completion_date ?? null,
    manager: order.manager ?? "—",
    budget: order.budget ?? null,
    description: order.description ?? "—",
    completedTasksCount: order.completed_tasks_count ?? 0,
    totalTasksCount: order.total_tasks_count ?? 0,
    completedTasksPercent: order.completed_tasks_percent ?? 0,
  };
}

function normalizeRelationalOrders(database) {
  const orders = Array.isArray(database.orders) ? database.orders : [];
  const clients = Array.isArray(database.clients) ? database.clients : [];
  const users = Array.isArray(database.users) ? database.users : [];
  const employees = Array.isArray(database.employees) ? database.employees : [];
  const tasks = Array.isArray(database.production_tasks) ? database.production_tasks : [];

  const clientsById = new Map(clients.map((client) => [Number(client.client_id), client]));
  const usersById = new Map(users.map((user) => [Number(user.user_id), user]));
  const employeesById = new Map(
    employees.map((employee) => {
      const linkedUser = usersById.get(Number(employee.user_id)) || {};

      return [
        Number(employee.employee_id),
        {
          name: linkedUser.full_name || "—",
          position: employee.position || "—",
        },
      ];
    }),
  );

  return orders.map((order, index) => {
    const linkedClient = clientsById.get(Number(order.client_id)) || {};
    const linkedUser = usersById.get(Number(linkedClient.user_id)) || {};
    const orderTasks = tasks.filter((task) => Number(task.order_id) === Number(order.order_id));
    const completedTasksCount = orderTasks.filter((task) => task.task_status === "Виконано").length;
    const totalTasksCount = orderTasks.length;
    const completedTasksPercent = totalTasksCount
      ? Math.round((completedTasksCount / totalTasksCount) * 100)
      : 0;

    const normalizedOrder = {
      id: order.order_id ?? index + 1,
      name: order.order_name || "—",
      client: linkedUser.full_name || linkedClient.company_name || "—",
      status: order.order_status || "Очікує",
      createdAt: order.created_at || null,
      deadline: order.planned_completion_date || null,
      actualDate: order.actual_completion_date || null,
      manager: getOrderManager(order.order_id, tasks, employeesById),
      description: order.description || "—",
      completedTasksCount,
      totalTasksCount,
      completedTasksPercent,
    };

    normalizedOrder.priority = getOrderPriority(normalizedOrder);
    normalizedOrder.budget = getOrderBudget(normalizedOrder, totalTasksCount);

    return normalizedOrder;
  });
}

function getOrdersData(database) {
  const directOrders = Array.isArray(database.orders)
    ? database.orders.filter((order) => "client" in order || "manager" in order || "budget" in order)
    : [];

  if (directOrders.length > 0) {
    console.log("[order-management-data] Using direct orders structure from database.json");
    return directOrders.map(normalizeDirectOrder);
  }

  console.log("[order-management-data] Using relational orders structure from database.json");
  return normalizeRelationalOrders(database);
}

function createUserCell(name) {
  return `
    <div class="user-cell">
      <div class="user-avatar">${getInitials(name)}</div>
      <div>
        <div class="user-name">${name}</div>
      </div>
    </div>
  `;
}

function createProgressCell(order) {
  const progressClass =
    order.status === "Виконано" ? "progress--success" : order.status === "Очікує" ? "progress--gray" : "progress--info";

  return `
    <div class="progress ${progressClass}">
      <div class="progress__bar" style="width: ${order.completedTasksPercent}%"></div>
    </div>
  `;
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

function createDetailedOrderRow(order) {
  return `
    <tr>
      <td>${order.id}</td>
      <td>${order.name}</td>
      <td>${order.client}</td>
      <td><span class="badge ${getBadgeClass(order.status, ORDER_STATUS_CLASS_MAP)}">${order.status}</span></td>
      <td><span class="badge ${getBadgeClass(order.priority, ORDER_PRIORITY_CLASS_MAP)}">${order.priority}</span></td>
      <td>${formatDate(order.createdAt)}</td>
      <td>${formatDate(order.deadline)}</td>
      <td>${order.manager}</td>
      <td>${formatBudget(order.budget)}</td>
      <td>${createActionsCell()}</td>
    </tr>
  `;
}

function createProgressOrderRow(order) {
  return `
    <tr>
      <td>${order.id}</td>
      <td>${order.name}</td>
      <td>${formatDate(order.createdAt)}</td>
      <td>${formatDate(order.deadline)}</td>
      <td>${formatDate(order.actualDate)}</td>
      <td>${createUserCell(order.client)}</td>
      <td>${order.description}</td>
      <td>${createProgressCell(order)}</td>
      <td><span class="badge ${getBadgeClass(order.status, ORDER_STATUS_CLASS_MAP)}">${order.status}</span></td>
      <td>${createActionsCell()}</td>
    </tr>
  `;
}

function renderOrdersTable(orders) {
  const tableBody = document.querySelector(ORDERS_TABLE_SELECTOR);

  if (!tableBody) {
    console.error(`[order-management-data] Table body not found: ${ORDERS_TABLE_SELECTOR}`);
    return;
  }

  const tableMode = getOrdersTableMode();
  const rowTemplate = tableMode === "detailed" ? createDetailedOrderRow : createProgressOrderRow;

  tableBody.innerHTML = orders.map(rowTemplate).join("");

  console.log(`[order-management-data] Rendered ${orders.length} order rows in ${tableMode} mode`);
}

async function fetchOrdersData() {
  console.log("[order-management-data] Fetching database.json...");

  const response = await fetch(ORDER_MANAGEMENT_DATA_URL);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${ORDER_MANAGEMENT_DATA_URL}`);
  }

  const json = await response.json();
  const database = Object.create(json);

  console.log("[order-management-data] Data is ready:", database);

  return database;
}

async function initOrdersTable() {
  try {
    const database = await fetchOrdersData();
    const orders = getOrdersData(database);

    if (!orders.length) {
      console.warn("[order-management-data] No orders found in database.json");
    }

    renderOrdersTable(orders);
  } catch (error) {
    console.error("[order-management-data] Error fetching data:", error);
  }
}

document.addEventListener("DOMContentLoaded", initOrdersTable);
