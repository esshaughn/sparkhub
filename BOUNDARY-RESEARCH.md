# Neighborhood boundaries for Spark Hub (research, 2026-10-12)

Short answer: **no authoritative "who owns this area" database exists.** Nextdoor's own founder said so. Austin's best layer, the City's Community Registry, lets polygons overlap freely by design. Plan for overlap; don't plan to prevent it.

## 1. How Nextdoor does it

- **The first member draws the boundary.** Your neighborhood is "defined by its first member," "might not align with official city boundaries and can include multiple subdivisions." You're placed by your address. Source: https://help.nextdoor.com/s/article/im-in-the-wrong-neighborhood (High)
- **Founders draw by picking homes.** If that's hard, Nextdoor support sets the boundary for them. Names should be "the official or generally accepted name," and Nextdoor may edit names. Source: https://help.nextdoor.com/s/article/Create-a-new-neighborhood-on-Nextdoor (High)
- **A new neighborhood is a 21-day "pilot."** It needs 10 verified members to launch, or it expires, so abandoned claims don't block someone else (same page). (High)
- **Boundary and name changes go through Nextdoor support**, not members ("contact us to make the change"). For a sub-area like an HOA, Nextdoor tells people to make a private Group, not a new neighborhood. Source: im-in-the-wrong-neighborhood page. (High)
- **Leads can edit boundaries in a lead tool.** The tool shows areas already in other neighborhoods in red, and adding them needs Nextdoor support. Source: third-party lead guide, https://kdburdick.x10.mx/Nextdoor-lead-lg-multi/ch16s08.html (Medium)
- **Changes that touch other neighborhoods go to a poll of the affected neighborhoods, then Nextdoor reviews.** Source: a Cedar Park, TX city handout, https://www.cedarparktexas.gov/DocumentCenter/View/222 (it blocked my fetch, so this comes from the search snippet). (Low–Medium)
- **I found no official statement that boundaries can't overlap.** In practice, address-based placement plus the "red = taken" editor suggests each address belongs to exactly one neighborhood. (Medium, inferred)
- **Nextdoor's founder said there is "no objective database of neighborhood boundaries" in US cities.** Nextdoor used Maponics polygons to pre-offer neighborhoods in some cities and lets users draw elsewhere. Neighborhoods can be as small as a single condo building. Source: https://computationalculture.net/welcome-to-the-polygon-contested-digital-neighborhoods-and-spatialized-segregation-on-nextdoor/ (Medium, academic)
- **Nearby neighborhoods.** Nearby areas are set automatically from your address (a "2.5–4 mile radius"), and members can't customize them. Posts can target Your neighborhood, Nearby, or Anyone. Sources: https://help.nextdoor.com/s/article/How-to-sort-your-newsfeed (High) and https://blog-en.ca.nextdoor.com/2020/11/11/new-features-help-you-stay-connected-to-more-of-the-neighbourhoods-you-care-about (Medium, dated 2020)
- **Two homes means two accounts.** Each account has one address and one neighborhood (im-in-the-wrong-neighborhood page). (High)

## 2. Austin public data (I queried the live services myself)

**City Community Registry** (zoning-notice sign-up)
- Polygon service: https://services.arcgis.com/0L95CJ0VTaxqcmED/ArcGIS/rest/services/BOUNDARIES_community_registry/FeatureServer/0
- Contact table: https://data.austintexas.gov/City-Government/Neighborhood-Groups-Community-Registry/u3yy-shmz
- 436 active polygons. The official description says boundaries "are not standardized and can take the geography desired by the registrant." (High)
- **Overlap is heavy.** The "Walnut Creek Neighborhood Association" polygon (last modified 2018) intersects 9 other registry polygons. Some are neighborhood groups (North Lamar NA, Gracywoods & North Park Estates NA, North Lamar/Georgian Acres Neighborhood Team). Others are citywide groups like Austin Neighborhoods Council and "Friends of Austin Neighborhoods." (High; my query. Intersects can include shared edges.)
- **The registry's names are close to what residents say.** It has Walnut Creek NA, Northeast Walnut Creek NA, Walnut Crossing NA, The Park at Walnut Creek HOA, and Walnut Creek Enclave HOA, so it's richer than Google. (High)
- The Travis County copy joins in contact names, emails and phones. Don't store those in the app. https://gis.traviscountytx.gov/server1/rest/services/Boundaries_and_Jurisdictions/Community_Registry_CoA/MapServer (High)

**Neighborhood Planning Areas**
- Service: https://services.arcgis.com/0L95CJ0VTaxqcmED/ArcGIS/rest/services/PLANNINGCADASTRE_neighborhood_planning_areas/FeatureServer/0
- 95 Council-set areas that don't overlap, but they're coarse. Walnut Creek NA falls inside "NORTH LAMAR" (plan approved). Good as a neutral reference grid, too big to be a group. (High)

**Subdivision plats**
- City service: https://services.arcgis.com/0L95CJ0VTaxqcmED/ArcGIS/rest/services/PLANNINGCADASTRE_subdivision_boundaries/FeatureServer/0
- 16,725 recorded plats. The Walnut Creek NA area holds 49 plats with about 19 base names (Oak Ridge, Spanish Oak Ridge, Walnut Forest, Eubank Acres, Park 35…). (High)
- These are legal building blocks, but they're split by section ("OAK RIDGE SEC 3") and include commercial plats.
- TCAD parcels (https://gis.traviscountytx.gov/server1/rest/services/Boundaries_and_Jurisdictions/TCAD_public/MapServer/0) carry a subdivision name (`sub_dec`) on every lot. (High)
- I couldn't confirm which three subdivisions the owner means by "Walnut Creek." Oak Ridge, Spanish Oak Ridge and Walnut Forest are candidates.

**HOA boundaries**
- I found no separate public HOA layer. Some HOAs appear in the Community Registry. (Medium)

**Licensing**
- City data is published "for public access and use," but dataset pages say "No license information was provided."
- The City's terms page wouldn't load for me: https://catalog.data.gov/dataset/city-of-austin-open-data-terms-of-use-policy (Medium)
- Texas government data is generally public information. Attribute "City of Austin" and add the "not for legal/survey use" disclaimer. I couldn't confirm an explicit open license.

## 3. General-purpose sources

| Source | Small-Austin coverage | License / cost | Confidence |
|---|---|---|---|
| OpenStreetMap | Mostly **points, not polygons** (e.g. Gracywoods, North Lamar, Windsor Park are `place=neighbourhood` nodes). "Walnut Creek" returns only the creek. | ODbL: free, attribution, share-alike on the derived database | High (my Nominatim lookups) |
| Geoapify Boundaries API | Built on OSM, so it inherits the same gaps | Storing allowed with OSM attribution; free plan 100k requests. https://www.geoapify.com/boundaries-api/ | High |
| Google Maps boundaries | No neighborhood type: country, admin 1/2, locality, postal code and school district only. https://developers.google.com/maps/documentation/javascript/dds-boundaries/overview | Styling only; I found no geometry download | High |
| Who's On First | US neighborhoods are mostly from Zetashapes/Quattroshapes, uneven; I didn't check Austin records | CC-BY per source. https://whosonfirst.org/getstarted | Low–Medium |
| Census block groups / places | Full coverage, but statistical lines that don't follow neighborhoods | Public domain | High |
| Zillow neighborhoods (2017, ~17k US) | Big-city names; frozen in 2017 | Conflicting licenses (CC BY-SA vs CC BY-NC). https://catalog.data.gov/dataset/neighborhoods-us-2017-zillow-segs | Medium |
| Precisely (ex-Maponics) Neighborhood Boundaries | Commercial, quarterly updates; this is what Nextdoor used | Sales quote only, no public price. https://www.precisely.com/data-guide/products/neighborhood-boundaries/ | Medium |

## 4. How others handle overlap

- **Cities split three ways.** Some ban overlap: La Crosse grandfathered existing overlaps, and an Amarillo draft refuses to recognize either group. Some allow it under conditions: Albuquerque and Jackson, MS allow a new group if it has more members in the overlap area or shows the existing group isn't representing it. Some simply live with it: Portland's Irvington has shared areas since the 1970s. Sources: https://cityoflacrosse.org/home/showpublisheddocument/840/637118353451230000, https://cabq.gov/planning/documents/O92Update1008.pdf, https://www.irvingtonpdx.com/neighborhood-boundaries (Medium)
- **Nextdoor's pattern:** one neighborhood per address, central staff approve changes, affected neighbors are polled, unlaunched claims expire, and sub-areas become Groups.

## 5. Pre-loading North Austin for "claim a neighborhood"

- **Best seed: the Community Registry.** Filter out the citywide and advocacy groups (e.g. drop polygons above a size threshold, or by Association_Category). It has real association names residents recognize, and you can store and display it with attribution. Downside: it overlaps by design and some polygons haven't been touched since 2018.
- **Building blocks: City subdivision plats**, grouped by base name, as the "pick several pieces" layer for cases like Walnut Creek = 3 subdivisions.
- **Reference only:** planning areas (too coarse); OSM and Google (no polygons).
- **Commercial:** only if a quote is cheap. It won't fix overlaps or local names any better.

## Recommendation for Spark Hub

1. **Seed** North Austin with Community Registry polygons, minus citywide groups, as claimable "known neighborhoods." Show the registry name, last-updated date and "City of Austin" credit. Don't import the contact fields.
2. **Let a group build its area** by picking a registry polygon, combining subdivision plats ("Walnut Creek = Oak Ridge + Spanish Oak Ridge + Walnut Forest"), or drawing one by hand. Give it its own display name.
3. **Allow overlap but flag it.** When a group's area overlaps another group's area by more than a small margin, publish it with an "overlaps X" flag and put it in a WAN review queue. WAN can adjust lines, merge groups, or approve the overlap, Nextdoor-style.
4. **One home neighborhood per person,** set from their address. When areas overlap, the person picks between them and can follow others as "nearby."
5. **Make claims expire if unused:** a Nextdoor-style pilot, e.g. N members within 21–30 days, so an early wrong claim can't lock out the real association.
6. **Keep an edit history** on every boundary, and give a "this area is ours" report button that goes to WAN.
