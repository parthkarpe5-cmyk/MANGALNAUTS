import gzip
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

RADIUS = 3396190
DEGREES = math.pi / 180
CTX_SOURCE = "https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic"
GALE_SOURCE = "https://github.com/Dipbroto/Martis-Ovikorsho/blob/HEAD/public/data/dem/index.json"

def export(site, values, west, north, dx, dy, source, spacing):
    graph_id = f"{site}_measured_dem_v1"
    rows, cols = values.shape
    valid = np.isfinite(values)
    nodes, edges = [], []
    palette = [(0,0,0,0),(244,199,106,135),(255,87,34,170),(204,57,86,200)]
    pixels = np.zeros((rows, cols, 4), dtype=np.uint8)
    for r, c in np.argwhere(valid):
        lat, lon = north - (r+.5)*dy, west + (c+.5)*dx
        elevation = values[r,c]
        horizontal = dx * DEGREES * RADIUS * math.cos(lat * DEGREES)
        vertical = dy * DEGREES * RADIUS
        slope = None
        if 0 < r < rows-1 and 0 < c < cols-1 and all((valid[r-1,c],valid[r+1,c],valid[r,c-1],valid[r,c+1])):
            gx = (values[r,c+1]-values[r,c-1])/(2*horizontal)
            gy = (values[r+1,c]-values[r-1,c])/(2*vertical)
            slope = math.degrees(math.atan(math.hypot(gx,gy)))
            pixels[r,c] = palette[0 if slope < 8 else 1 if slope < 15 else 2 if slope < 20 else 3]
        nodes.append(dict(id=f"n_{r}_{c}",lat=round(lat,8),lon=round(lon,8),
                          elev_m=round(float(elevation),3),slope_deg=round(slope,2) if slope is not None else None))
        for dr, dc in ((0,1),(1,0),(1,1),(1,-1)):
            rr, cc = r+dr,c+dc
            if not (0 <= rr < rows and 0 <= cc < cols and valid[rr,cc]):
                continue
            distance = math.hypot(dc*horizontal, dr*vertical)
            edge = dict(**{"from":f"n_{r}_{c}","to":f"n_{rr}_{cc}"},length_m=round(distance,4))
            if dr and dc:
                if not (valid[r,cc] and valid[rr,c]):
                    continue
                # Both orthogonal passages around the corner must meet the travel grade limit.
                edge["crossing_grade_deg"] = max(
                    math.degrees(math.atan(abs(float(rise))/length))
                    for rise,length in ((values[r,cc]-elevation,horizontal),
                    (values[rr,c]-elevation,vertical),(values[rr,cc]-values[r,cc],vertical),
                    (values[rr,cc]-values[rr,c],horizontal)))
            edges.append(edge)
    if not edges:
        raise ValueError(f"No valid edges for {site}")
    folder = Path("data")/site/"measured"
    folder.mkdir(parents=True,exist_ok=True)
    bounds = dict(west=west,east=west+cols*dx,north=north,south=north-rows*dy)
    graph = dict(graph_id=graph_id,bbox=bounds,source=source,spacing_m=spacing,
                 max_snap_m=round(spacing*.8,2),nodes=nodes,edges=edges)
    (folder/"terrain_graph.json").write_text(json.dumps(graph,separators=(",",":")),encoding="utf-8")
    Image.fromarray(pixels).save(folder/"slope.png")
    (folder/"gnn_scores.json").write_text('{"nodes":{}}',encoding="ascii")
    (folder/"routes.geojson").write_text('{"type":"FeatureCollection","features":[]}',encoding="ascii")
    print(site,len(nodes),len(edges),bounds)
    return graph_id,bounds,folder.as_posix()

def main():
    image = Image.open(sys.argv[1])
    tags = image.tag_v2
    sx,sy,_ = tags[33550]
    _,_,_,x0,y0,_ = tags[33922]
    standard_parallel = tags[34736][2]
    assert tags[34736][1] == 0 and tags[34736][5] == RADIUS
    dx,dy = sx/(RADIUS*DEGREES*math.cos(standard_parallel*DEGREES)),sy/(RADIUS*DEGREES)
    west,north = x0/sx*dx,y0/sy*dy
    col,row = int((77.425-west)/dx),int((north-18.45)/dy)
    c,r = col-46,row-46
    assert 0 <= c < image.width-92 and 0 <= r < image.height-92
    values = np.asarray(image.crop((c,r,c+92,r+92)),dtype=float)
    values[values < -1e20] = np.nan
    jezero = export("jezero",values,west+c*dx,north-r*dy,dx,dy,CTX_SOURCE,20)
    folder = Path(sys.argv[2])
    index = json.loads((folder/"index.json").read_text(encoding="utf-8"))
    meta = next(g for g in index["grids"] if g["id"]=="gale")
    raster = np.frombuffer(gzip.decompress((folder/"gale.i16z").read_bytes()),dtype="<i2")
    raster = raster.reshape((meta["height"],meta["width"]))
    dx=(meta["east"]-meta["west"])/meta["width"]
    dy=(meta["north"]-meta["south"])/meta["height"]
    c=math.floor((137.33-meta["west"])/dx)
    r=math.floor((meta["north"]+4.58)/dy)
    cols=math.ceil((137.46-meta["west"])/dx)-c
    rows=math.ceil((meta["north"]+4.72)/dy)-r
    values=raster[r:r+rows,c:c+cols].astype(float)
    values[values==index["nodata"]]=np.nan
    gale=export("gale",values,meta["west"]+c*dx,meta["north"]-r*dy,dx,dy,GALE_SOURCE,200)
    manifest=Path("data/manifest.json")
    config=json.loads(manifest.read_text(encoding="utf-8"))
    for site,(graph_id,bounds,path) in (("jezero",jezero),("gale",gale)):
        entry=config["sites"][site]
        entry.update(graph_id=graph_id,bbox=bounds)
        entry["files"].update(terrain_graph=f"{path}/terrain_graph.json",gnn_scores=f"{path}/gnn_scores.json",routes=f"{path}/routes.geojson",slope=f"{path}/slope.png")
    for key in ("graph_id","bbox","files"):
        config[key]=config["sites"]["jezero"][key]
    manifest.write_text(json.dumps(config,indent=2)+"\n",encoding="utf-8")

if __name__=="__main__":
    main()
