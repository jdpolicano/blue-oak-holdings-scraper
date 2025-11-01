import { TheDynastyBA } from "./thedynastyba.js";
import { SunbeltNetwork } from "./sunbeltnetwork.js";
import { TWorld } from "./tworld.js";
import { TheCBAGroup } from "./thecbagroup.js";
import { BizBuySell } from "./bizbuysell.js";
import { Enlign } from "./enlign.js";
import { VRBusinessBrokers } from "./vrbusinessbrokers.js";
import { FCBB } from "./fcbb.js";
import { VikingMergers } from "./vikingmergers.js";
import { BeaconAdvisors } from "./beaconadvisors.js";
import { Midstreet } from "./midstreet.js";
import { BAMA } from "./bama.js";
import { BatonMarket } from "./batonmarket.js";
import { MorganWestfield } from "./morganwestfield.js";
import { PronovaPartners } from "./pronovapartners.js";
import { BaseScrapeObject } from "./base.js";
import { IAGMerger } from "./iagmerger.js";
import { BossGI } from "./bossgi.js";
import { LisitenAssociates } from "./lisitenassociates.js";
import { TheMagnoliaFirm } from "./themagnoliafirm.js";
import { BizEx } from "./bizex.js";

type ScrapeConstructor = new () => BaseScrapeObject;

class Registry {
  private entries: Map<string, BaseScrapeObject>;

  constructor() {
    const sites: ScrapeConstructor[] = [
      TheDynastyBA,
      SunbeltNetwork,
      TWorld,
      TheCBAGroup,
      BizBuySell,
      Enlign,
      VRBusinessBrokers,
      FCBB,
      VikingMergers,
      BeaconAdvisors,
      Midstreet,
      BAMA,
      BatonMarket,
      MorganWestfield,
      PronovaPartners,
      IAGMerger,
      BossGI,
      LisitenAssociates,
      TheMagnoliaFirm,
      BizEx,
    ];
    this.entries = new Map();
    for (const siteConstructor of sites) {
      const site = new siteConstructor();
      this.entries.set(site.site, site);
    }
  }

  get(key: string): BaseScrapeObject | undefined {
    const c = this.entries.get(key);
    if (c) {
      return c;
    }
  }

  list(keys: string[]): BaseScrapeObject[] {
    const results = [];
    for (const key of keys) {
      if (this.entries.has(key)) {
        results.push(this.get(key)!);
      }
    }
    return results;
  }

  all(): BaseScrapeObject[] {
    return [...this.entries.values()];
  }
}

export const registry = new Registry();
