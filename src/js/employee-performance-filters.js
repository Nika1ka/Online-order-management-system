const EMPLOYEE_PERFORMANCE_DATA_URL = "../database.json";

const EMPLOYEE_PERFORMANCE_FILTER_SELECTORS = {
  position: "#employee-performance-position-filter",
  department: "#employee-performance-department-filter",
};

function createOptionsMarkup(defaultLabel, values) {
  const options = values.map((value) => `<option value="${value}">${value}</option>`).join("");
  return `<option value="">${defaultLabel}</option>${options}`;
}

function getUniqueSortedValues(items, key) {
  return [...new Set(items.map((item) => item[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "uk"));
}

function normalizeEmployees(database) {
  const employees = Array.isArray(database.employees) ? database.employees : [];
  return employees.map((employee) => ({
    position: employee.position || "",
    department: employee.department || "",
  }));
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

  console.log("[employee-performance-filters] Position and department filters populated");
}

async function fetchEmployeePerformanceData() {
  console.log("[employee-performance-filters] Fetching database.json...");

  const response = await fetch(EMPLOYEE_PERFORMANCE_DATA_URL);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching ${EMPLOYEE_PERFORMANCE_DATA_URL}`);
  }

  const json = await response.json();
  const database = Object.create(json);

  console.log("[employee-performance-filters] Data is ready:", database);

  return database;
}

async function initEmployeePerformanceFilters() {
  try {
    const database = await fetchEmployeePerformanceData();
    const employees = normalizeEmployees(database);

    if (!employees.length) {
      console.warn("[employee-performance-filters] No employees found in database.json");
    }

    populateEmployeePerformanceFilters(employees);
  } catch (error) {
    console.error("[employee-performance-filters] Error fetching data:", error);
  }
}

document.addEventListener("DOMContentLoaded", initEmployeePerformanceFilters);
