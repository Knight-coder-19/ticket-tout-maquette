self.__MIDDLEWARE_MATCHERS = [
  {
    "regexp": "^\\/G-SVR-500-COT-5-1-survivor-21(?:\\/(_next\\/data\\/[^/]{1,}))?\\/salarie(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$",
    "originalSource": "/salarie/:path*"
  },
  {
    "regexp": "^\\/G-SVR-500-COT-5-1-survivor-21(?:\\/(_next\\/data\\/[^/]{1,}))?\\/partenaire(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$",
    "originalSource": "/partenaire/:path*"
  },
  {
    "regexp": "^\\/G-SVR-500-COT-5-1-survivor-21(?:\\/(_next\\/data\\/[^/]{1,}))?\\/administration(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$",
    "originalSource": "/administration/:path*"
  }
];self.__MIDDLEWARE_MATCHERS_CB && self.__MIDDLEWARE_MATCHERS_CB()