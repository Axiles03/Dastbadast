import { TypedDocumentNode } from "@graphql-typed-document-node/core";

declare global {
  namespace Apollo {
    interface Data {
      // По умолчанию any — чтобы useQuery без generic работал без ошибок
      [key: string]: any;
    }
    interface Variables {
      [key: string]: any;
    }
  }
}

export {};
