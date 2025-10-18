import {
  SunbeltNetwork,
  TheDynastyBA,
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
} from "./adapters/index.js";
import { ScrapeHandle } from "./core/scrape.js";
import pino from "pino";

const logger = pino();

export const handler = async (_: unknown) => {
  const sites = [
    new Enlign(),
    new BizBuySell(),
    new TheCBAGroup(),
    new TWorld(),
    new TheDynastyBA(),
    new SunbeltNetwork(),
    new VRBusinessBrokers(),
    new FCBB(),
    new VikingMergers(),
    new BeaconAdvisors(),
    new Midstreet(),
    new BAMA(),
    new BatonMarket(),
    new MorganWestfield(),
  ];
  const handle = await ScrapeHandle.create({
    logger,
    sites,
  });
  await handle.run();
};

handler(null);
