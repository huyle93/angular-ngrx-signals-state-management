# A3 — actual Nx project graph

Generated with `npx nx graph --file=/tmp/a3-graph.json`; external npm nodes omitted.

```mermaid
flowchart TD
  demo-design["demo-design"]
  fi-mobile["fi-mobile"]
  fi-web["fi-web"]
  instrument-data-access["instrument-data-access"]
  instrument-ui["instrument-ui"]
  instrument-util["instrument-util"]
  mobile-reference["mobile-reference"]
  trading-feature["trading-feature"]
  web-app["web-app"]
  fi-mobile --> instrument-data-access
  fi-mobile --> instrument-ui
  fi-mobile --> trading-feature
  fi-mobile --> demo-design
  fi-web --> instrument-data-access
  fi-web --> instrument-ui
  fi-web --> trading-feature
  fi-web --> demo-design
  instrument-data-access --> instrument-util
  instrument-ui --> instrument-util
  mobile-reference --> fi-mobile
  web-app --> fi-web
```

The same graph is enforced by `eslint.config.cjs`. `domain:instrument` cannot import `domain:trading`; only `domain:composition` assembles them. UI cannot import state, and libraries cannot import applications.
