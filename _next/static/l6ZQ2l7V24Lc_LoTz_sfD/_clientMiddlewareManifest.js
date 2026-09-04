self.__MIDDLEWARE_MATCHERS = [
  {
    "regexp": "^\\/ticket-tout-maquette(?:\\/(_next\\/data\\/[^/]{1,}))?\\/salarie(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$",
    "originalSource": "/salarie/:path*"
  },
  {
    "regexp": "^\\/ticket-tout-maquette(?:\\/(_next\\/data\\/[^/]{1,}))?\\/partenaire(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$",
    "originalSource": "/partenaire/:path*"
  },
  {
    "regexp": "^\\/ticket-tout-maquette(?:\\/(_next\\/data\\/[^/]{1,}))?\\/administration(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?(\\.json|\\.rsc|\\.segments\\/.+\\.segment\\.rsc)?[\\/#\\?]?$",
    "originalSource": "/administration/:path*"
  }
];self.__MIDDLEWARE_MATCHERS_CB && self.__MIDDLEWARE_MATCHERS_CB()