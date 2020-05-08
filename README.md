# ipfs-tiles

Experimental map tiles hosting over IPFS.

The purpose of this project is to leverage great existing open tools and provide a real-world usable peer 2 peer tiles hosting system.

## Similar projects and discussions

  - [ipfs-maps](https://github.com/davidar/ipfs-maps) - not active, no doc, etc.
  - [map based on ipfs-maps](https://ipfs.io/ipfs/QmNUFNQXWVzbhePhj6bscW6TPu5azraCpbejbNY9zyfFjo/#6.63/46.734/6.844)
  - [osm-ipfs-proxy](https://github.com/lazyweirdo/osm-ipfs-proxy) - php proxy instead of pure ipfs approach, raster instead of vector tiles, not what I imagine

All in all the subject seems intrigue many people, but there is not a dynamic project that makes real progress and offers a true real-world hosting potential. There is something to be done here.

## Design ideas

Make something as purely based on ipfs as possible. The idea is that after a small initial investment of hosting and domain name by Koumoul the project should persist and scale in full autonomy.

Provide scripts similar to ipfs-maps that create mbtiles using OpenMapTiles then extract them.

Add these extracted vector tiles (and tileset metadatas) on IPFS and pin them on a stable node (either self-hosted or using some pinning service like pinata).

Use DNSLinks to map each tileset to a domain and so provide URLs to an updatable content.

Focus on vector tiles, but raster should be a possibility.

Create a small static application also hosted on IPFS that will:

  - reference known tilesets with all useful metadatas
  - contain mapbox styles, fonts, glyphs, etc
  - actually render the styles / tilesets in simple maps
  - render these simple maps in full pages with navigation query params, appropriate for linking and embedding maps
  - provide code recipes to use the resources and create own maps
  - code recipes should include the mean to use actual ipfs procotol instead of public HTTP gateways (service worker ? https://github.com/ipfs-shipyard/ipfs-service-worker-demos)
  - provide all useful information for people willing to pin the data and therefore help improve the service

## Potential tools

  - [mbutil](https://github.com/ipfs-shipyard/ipfs-service-worker-demos) extract mbtiles into directories
  - [openmaptiles-language](https://github.com/klokantech/openmaptiles-language)

## Questions

  - find out if it is possible with OpenMapTiles to work region by region but to merge them all in a world tileset as time goes by. It is possible using tile-join on the mbtiles, but can it be done simply by extracting tiles in the same directory.

## Development

Fetch a [sample mbtiles](https://docs.mapbox.com/help/data/trails.mbtiles) file and put it in ./data

```
docker-compose up -d
docker-compose exec ipfs ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
docker-compose exec ipfs ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["GET", "PUT", "POST"]'
docker-compose exec ipfs ipfs config --json Gateway.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
docker-compose exec ipfs ipfs config --json Gateway.HTTPHeaders.Access-Control-Allow-Methods '["GET", "PUT", "POST"]'
docker-compose restart
```

Node should be manageable with [ipfs-webui](https://webui.ipfs.io/#/).

Run command to import mbtiles into your IPFS node.

```
DEBUG=ipfs-tiles bin/ipfs-tiles.js add data/trails.mbtiles
```

Run Web application.

```
npm run dev
```
