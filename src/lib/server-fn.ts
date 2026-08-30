/**
 * Universal Server Function adapter for Next.js App Router
 * Provides type-safe validator/handler chain with identical interface to createServerFn
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
        const rawData =
          payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
        let validated = rawData;
        if (validatorFnOrSchema) {
          if (typeof validatorFnOrSchema.parse === "function") {
            validated = validatorFnOrSchema.parse(rawData);
          } else if (typeof validatorFnOrSchema === "function") {
            validated = validatorFnOrSchema(rawData);
          }
        }
        return handlerFn({ data: validated });
      };
      return fn;
    },
  });

  return {
    validator: createValidator,
    inputValidator: createValidator,
    handler<R = any>(handlerFn: (ctx: { data: any }) => Promise<R>) {
      const fn = async (payload?: { data?: any } | any): Promise<R> => {
        const rawData =
          payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
        return handlerFn({ data: rawData });
      };
      return fn;
    },
  };
}
