// Invalid client input. `field` tells the UI which input to highlight.
export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class NotFoundError extends Error {
  constructor(message = 'No encontrado') {
    super(message);
    this.name = 'NotFoundError';
  }
}

// A business rule detected outside a stored procedure.
export class BusinessError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BusinessError';
  }
}
