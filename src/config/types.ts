export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS"
  | "TRACE";

export type RouteRule = {
  path: string; // glob like "/users/**"
  methods?: HttpMethod[];
};

export type SpecRoutes = {
  include?: RouteRule[];
  exclude?: RouteRule[];
};

export type SpecConfig = {
  id?: string;
  input: string; // file OR folder
  routes?: SpecRoutes;
};

export type Config = {
  version: 1;
  allowV2Conversion: boolean;

  output: {
    dir: string;
    perSpecFileName: string; // template supports {specId}
    mergedFileName: string;
  };

  mode: {
    mergeOutput: boolean;
  };

  features: {
    pruneUnusedSchemas: boolean;
  };

  specs: SpecConfig[];
};

export type ExpandedSpecInput = {
  specId: string;
  sourcePath: string;
  routes: SpecRoutes;
  document: any; // OpenAPI 3 document object
};
