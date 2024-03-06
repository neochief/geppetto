#!/usr/bin/env node

import { main } from "../main";
import colors from "colors/safe";

main().catch((e) => {
    console.error(colors.bgRed(e?.message || e));
});