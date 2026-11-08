const freezeDefinitions = definitions => Object.freeze(definitions.map(item => Object.freeze({ ...item })));

export const PRIORITY_DEFINITIONS = freezeDefinitions([
  { value: 'Low', label: 'Niski', tone: 'green' },
  { value: 'Medium', label: 'Średni', tone: 'blue' },
  { value: 'High', label: 'Wysoki', tone: 'amber' },
  { value: 'Critical', label: 'Krytyczny', tone: 'red' }
]);

export const PRIORITY_VALUES = Object.freeze(PRIORITY_DEFINITIONS.map(item => item.value));

export const DEFAULT_STATUS_WORKFLOW_STATES = freezeDefinitions([
  { system_key: 'never_checked', value: 'Never checked', label: 'Nigdy nie sprawdzone', icon: '◎', description: 'Nikt jeszcze nie zweryfikował tego punktu.', included: 1, counts_as_done: 0, tone: 'gray' },
  { system_key: 'ready', value: 'Ready to test', label: 'Gotowe do sprawdzenia', icon: '○', description: 'Można rozpocząć lub kontynuować pracę.', included: 1, counts_as_done: 0, tone: 'amber' },
  { system_key: 'progress', value: 'In progress', label: 'W trakcie', icon: '●', description: 'Praca nad punktem trwa.', included: 1, counts_as_done: 0, tone: 'blue' },
  { system_key: 'blocked', value: 'Blocked', label: 'Zablokowany', icon: '⊘', description: 'Praca oczekuje na zależność albo wskazaną przyczynę.', included: 1, counts_as_done: 0, tone: 'red' },
  { system_key: 'retest', value: 'NOK / Retest required', label: 'NOK / wymagany retest', icon: '↻', description: 'Test trzeba powtórzyć po usunięciu przyczyny.', included: 1, counts_as_done: 0, tone: 'red' },
  { system_key: 'done', value: 'Done', label: 'Gotowe', icon: '✓', description: 'Punkt został ukończony.', included: 1, counts_as_done: 1, tone: 'green' },
  { system_key: 'na', value: 'N/A', label: 'N/A', icon: '—', description: 'Punkt nie jest już istotny.', included: 1, counts_as_done: 1, tone: 'gray' }
]);

export const ENTITY_STATUS_DEFINITIONS = Object.freeze({
  status: DEFAULT_STATUS_WORKFLOW_STATES,
  task: freezeDefinitions([
    { value: 'To do', label: 'Do zrobienia', tone: 'gray' },
    { value: 'In progress', label: 'W trakcie', tone: 'blue' },
    { value: 'Blocked', label: 'Zablokowane', tone: 'red', requires_comment: true },
    { value: 'NOK / Retest required', label: 'NOK / wymagany retest', tone: 'red', requires_comment: true },
    { value: 'Done', label: 'Gotowe', tone: 'green', complete: true }
  ]),
  point: freezeDefinitions([
    { value: 'Open', label: 'Otwarte', tone: 'red' },
    { value: 'In progress', label: 'W trakcie', tone: 'blue' },
    { value: 'Waiting', label: 'Oczekiwanie', tone: 'amber' },
    { value: 'Closed', label: 'Zamknięte', tone: 'green', complete: true }
  ]),
  goal: freezeDefinitions([
    { value: 'Open', label: 'Otwarte', tone: 'red' },
    { value: 'In progress', label: 'W trakcie', tone: 'blue' },
    { value: 'Done', label: 'Gotowe', tone: 'green', complete: true }
  ])
});

export const LEGACY_STATUS_ALIASES = Object.freeze({
  'Not started': 'Ready to test',
  'NOK / Rework': 'NOK / Retest required',
  'Retest required': 'NOK / Retest required'
});

export function statusDefinitions(entityType) {
  return ENTITY_STATUS_DEFINITIONS[entityType] || Object.freeze([]);
}

export function statusValues(entityType) {
  return statusDefinitions(entityType).map(item => item.value);
}

export function normalizeWorkflowStatus(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return LEGACY_STATUS_ALIASES[normalized] || normalized;
}

export function workflowDefinition(value, entityType = '') {
  const normalized = normalizeWorkflowStatus(value);
  const definitions = entityType ? statusDefinitions(entityType) : Object.values(ENTITY_STATUS_DEFINITIONS).flat();
  return definitions.find(item => item.value === normalized) || PRIORITY_DEFINITIONS.find(item => item.value === normalized) || null;
}

export function workflowLabel(value, entityType = '') {
  return workflowDefinition(value, entityType)?.label || normalizeWorkflowStatus(value) || '—';
}

export function workflowTone(value, entityType = '') {
  return workflowDefinition(value, entityType)?.tone || 'gray';
}

export function isCompleteStatus(entityType, value) {
  return Boolean(workflowDefinition(value, entityType)?.complete || (entityType === 'status' && workflowDefinition(value, entityType)?.counts_as_done));
}

export function requiresStatusComment(entityType, value) {
  return Boolean(workflowDefinition(value, entityType)?.requires_comment);
}
