# A3 — actual Nx project graph

Generated with `npx nx graph --file=/tmp/a3-modal-graph.json`; external npm nodes omitted.

```mermaid
flowchart TD
  demo-design["demo-design"]
  fi-mobile["fi-mobile"]
  fi-web["fi-web"]
  instrument-data-access["instrument-data-access"]
  instrument-ui["instrument-ui"]
  instrument-util["instrument-util"]
  mobile-reference["mobile-reference"]
  trading-data-access["trading-data-access"]
  trading-feature["trading-feature"]
  trading-ui["trading-ui"]
  trading-util["trading-util"]
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
  mobile-reference --> fi-mobile
  trading-data-access --> trading-util
  trading-feature --> trading-data-access
  trading-feature --> trading-ui
  trading-ui --> trading-util
  web-app --> fi-web
```

The same graph is enforced by `eslint.config.cjs`. Instrument and trading domains cannot import each other; only experience wrappers assemble them. UI cannot import state, data-access can depend on util, util has no Angular/Ionic dependency, and libraries cannot import applications. The boundary target exercises ten expected import rejections.
