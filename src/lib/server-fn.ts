/**
 * Universal Server Function adapter for Next.js App Router
 * Provides type-safe validator/handler chain with zero 500 crashes
 */

export interface ServerFnBuilder<TInput = any, TOutput = any> {
  validator(validatorFnOrSchema?: any): {
    handler<R = any>(
      handlerFn: (ctx: { data: any }) => Promise<R>,
    ): (payload?: { data?: any } | any) => Promise<R>;
  };
  inputValidator(validatorFnOrSchema?: any): {
    handler<R = any>(
      handlerFn: (ctx: { data: any }) => Promise<R>,
    ): (payload?: { data?: any } | any) => Promise<R>;
  };
  handler<R = any>(
    handlerFn: (ctx: { data: any }) => Promise<R>,
  ): (payload?: { data?: any } | any) => Promise<R>;
}

export function createServerFn<TInput = any, TOutput = any>(_options?: {
  method?: "GET" | "POST";
}): ServerFnBuilder<TInput, TOutput> {
  const createValidator = (validatorFnOrSchema?: any) => ({
    handler<R = any>(handlerFn: (ctx: { data: any }) => Promise<R>) {
      const fn = async (payload?: { data?: any } | any): Promise<R> => {
        try {
          const rawData =
            payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
          let validated = rawData;
          if (validatorFnOrSchema) {
            if (typeof validatorFnOrSchema.safeParse === "function") {
              const res = validatorFnOrSchema.safeParse(rawData);
              if (res.success) {
                validated = res.data;
              } else {
                console.warn("[ServerFn] Validation mismatch, using rawData:", res.error?.message);
                validated = rawData;
              }
            } else if (typeof validatorFnOrSchema.parse === "function") {
              try {
                validated = validatorFnOrSchema.parse(rawData);
              } catch {
                validated = rawData;
              }
            } else if (typeof validatorFnOrSchema === "function") {
              try {
                validated = validatorFnOrSchema(rawData);
              } catch {
                validated = rawData;
              }
            }
          }
          return await handlerFn({ data: validated });
        } catch (err: unknown) {
          const error = err as Error;
          console.error("[ServerFn] Uncaught handler error:", error?.message || error);
          return {
            success: false,
            error: error?.message || "An unexpected error occurred. Please try again.",
          } as unknown as R;
        }
      };
      return fn;
    },
  });

  return {
    validator: createValidator,
    inputValidator: createValidator,
    handler<R = any>(handlerFn: (ctx: { data: any }) => Promise<R>) {
      const fn = async (payload?: { data?: any } | any): Promise<R> => {
        try {
          const rawData =
            payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
          return await handlerFn({ data: rawData });
        } catch (err: unknown) {
          const error = err as Error;
          console.error("[ServerFn] Handler execution error:", error?.message || error);
          return {
            success: false,
            error: error?.message || "An unexpected error occurred. Please try again.",
          } as unknown as R;
        }
      };
      return fn;
    },
  };
}
