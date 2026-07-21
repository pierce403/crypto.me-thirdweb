export function createRetryableResource(factory) {
  let activeAttempt;

  return {
    get() {
      if (!activeAttempt) {
        const attempt = Promise.resolve().then(factory);
        activeAttempt = attempt;
        void attempt.catch(() => {
          if (activeAttempt === attempt) activeAttempt = undefined;
        });
      }
      return activeAttempt;
    },
    invalidate(attempt) {
      if (!attempt || activeAttempt === attempt) activeAttempt = undefined;
    },
  };
}

export function withTimeout(operation, timeoutMs, onTimeout) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      onTimeout?.();
      reject(new Error(`XMTP lookup timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    operation.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}
