import { TypedDocumentNode } from "@graphql-typed-document-node/core";

declare global {
  namespace Apollo {
    interface Data {
      // any — на этапе MVP без codegen
      [key: string]: any;
    }
    interface Variables {
      [key: string]: any;
    }
  }
}

export {};
