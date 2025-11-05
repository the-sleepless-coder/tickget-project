import { useEffect, useRef } from "react";

export default function MediumVenue() {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // interactive tooltip/hover/click removed

    // normalize polygon colors and remove outlines per level spec
    const normalizePolygons = () => {
      const svg = rootRef.current?.querySelector("svg");
      if (!svg) return;
      const polygons = Array.from(
        svg.querySelectorAll("polygon")
      ) as SVGPolygonElement[];
      polygons.forEach((p) => {
        const level = p.getAttribute("data-seat-level") || "";
        const idAttr = p.getAttribute("data-id") || "";
        let fill: string | null = null;
        if (level === "STANDING") fill = "#FE4AB9";
        else if (level === "VIP") fill = "#7C50E4";
        else if (level === "R") fill = "#4CA0FF";
        else if (level === "S") fill = "#FFCC10";
        // id=0 areas (e.g., STAGE/CONSOLE) should be black
        if (idAttr === "0") fill = "#949494";
        if (fill) {
          p.setAttribute("fill", fill);
          p.setAttribute("data-fill", fill);
          const existingStyle = p.getAttribute("style") || "";
          const styleWithoutFill = existingStyle
            .split(";")
            .filter((s) => s.trim() && !s.trim().startsWith("fill:"))
            .join(";");
          const nextStyle = `fill:${fill};${styleWithoutFill}`;
          p.setAttribute("style", nextStyle);
        }
        p.removeAttribute("stroke");
        p.removeAttribute("stroke-opacity");
        p.removeAttribute("stroke-width");
      });
    };

    // tighten viewBox to the union of all polygons so they fill the svg
    const fitSvgToPolygons = () => {
      const svg = rootRef.current?.querySelector("svg");
      if (!svg) return;
      const polygons = Array.from(
        svg.querySelectorAll("polygon")
      ) as SVGPolygonElement[];
      if (polygons.length === 0) return;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      polygons.forEach((p) => {
        const b = p.getBBox();
        if (
          !isFinite(b.x) ||
          !isFinite(b.y) ||
          !isFinite(b.width) ||
          !isFinite(b.height)
        )
          return;
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      });
      if (
        !isFinite(minX) ||
        !isFinite(minY) ||
        !isFinite(maxX) ||
        !isFinite(maxY)
      )
        return;
      const padding = 8; // small breathing room
      const vbX = minX - padding;
      const vbY = minY - padding;
      const vbW = Math.max(1, maxX - minX + padding * 2);
      const vbH = Math.max(1, maxY - minY + padding * 2);
      svg.setAttribute("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`);
    };

    // add centered numeric labels to polygons (except id=0) and keep them persistent
    const applyLabels = () => {
      const svg = rootRef.current?.querySelector("svg");
      if (!svg) return;
      // ensure polygons are normalized before labeling
      normalizePolygons();
      // adjust viewBox so polygons occupy the full svg area
      fitSvgToPolygons();
      // remove previous dedicated layer if exists
      const prevLayer = svg.querySelector('g[data-seat-label-layer="1"]');
      if (prevLayer && prevLayer.parentNode)
        prevLayer.parentNode.removeChild(prevLayer);
      const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
      layer.setAttribute("data-seat-label-layer", "1");
      layer.setAttribute("pointer-events", "none");
      const polygons = Array.from(
        svg.querySelectorAll("polygon")
      ) as SVGPolygonElement[];
      polygons.forEach((p) => {
        const id = p.getAttribute("data-id") || "";
        const level = p.getAttribute("data-seat-level") || "";
        const bbox = p.getBBox();
        const cx = bbox.x + bbox.width / 2;
        const cy = bbox.y + bbox.height / 2;
        // STAGE (id=0 & seat-level=STAGE) → show label "STAGE"
        if (id === "0" && level === "STAGE") {
          const t = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text"
          );
          const stageYOffset = 90;
          t.setAttribute("x", String(cx));
          t.setAttribute("y", String(cy - stageYOffset));
          t.setAttribute("text-anchor", "middle");
          t.setAttribute("dominant-baseline", "middle");
          t.setAttribute("data-seat-label", "1");
          t.setAttribute("fill", "#ffffff");
          t.setAttribute("font-size", "20");
          t.setAttribute("font-weight", "bold");
          t.setAttribute(
            "style",
            [
              "pointer-events:none",
              "font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial",
            ].join(";")
          );
          t.textContent = "STAGE";
          layer.appendChild(t);
          return;
        }
        // Regular numeric ids (except 0)
        if (/^\d+$/.test(id) && id !== "0") {
          const text = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text"
          );
          text.setAttribute("x", String(cx));
          text.setAttribute("y", String(cy));
          text.setAttribute("text-anchor", "middle");
          text.setAttribute("dominant-baseline", "middle");
          text.setAttribute("data-seat-label", "1");
          // set as element attributes to avoid CSS overrides
          text.setAttribute("fill", "#ffffff");
          text.setAttribute("font-size", "16");
          text.setAttribute("font-weight", "bold");
          text.setAttribute(
            "style",
            [
              "pointer-events:none",
              "font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial",
            ].join(";")
          );
          text.textContent = id;
          layer.appendChild(text);
        }
      });
      svg.appendChild(layer);
    };

    // initial normalize + label draw
    applyLabels();

    // Observe DOM changes to re-apply labels if the SVG subtree gets replaced
    const observer = new MutationObserver(() => {
      // avoid infinite loops by disconnecting during re-apply
      observer.disconnect();
      requestAnimationFrame(() => {
        applyLabels();
        if (rootRef.current) {
          observer.observe(rootRef.current, { childList: true, subtree: true });
        }
      });
    });
    if (rootRef.current) {
      observer.observe(rootRef.current, { childList: true, subtree: true });
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const content = `
<div class='wrapper'>
  <div class='card'>
    <svg viewBox="0 0 1164 1076" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id='pat_poly_0003' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#060606'/><rect width='4' height='8' fill='#CECECE'/></pattern>
        <pattern id='pat_poly_0004' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#000000'/><rect width='4' height='8' fill='#B3B3B3'/></pattern>
        <pattern id='pat_poly_0005' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#060606'/><rect width='4' height='8' fill='#626262'/></pattern>
        <pattern id='pat_poly_0006' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#060707'/><rect width='4' height='8' fill='#A2A6A7'/></pattern>
        <pattern id='pat_poly_0007' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#030303'/><rect width='4' height='8' fill='#ACACAC'/></pattern>
        <pattern id='pat_poly_0008' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#020202'/><rect width='4' height='8' fill='#D7D7D7'/></pattern>
        <pattern id='pat_poly_0009' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#000000'/><rect width='4' height='8' fill='#B9B9B9'/></pattern>
        <pattern id='pat_poly_0010' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#060606'/><rect width='4' height='8' fill='#CECECE'/></pattern>
        <pattern id='pat_poly_0011' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#060707'/><rect width='4' height='8' fill='#A2A6A7'/></pattern>
        <pattern id='pat_poly_0013' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#0C0D0F'/><rect width='4' height='8' fill='#D3D3D5'/></pattern>
        <pattern id='pat_poly_0014' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#0C0D0F'/><rect width='4' height='8' fill='#CFD0D2'/></pattern>
        <pattern id='pat_poly_0016' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#111214'/><rect width='4' height='8' fill='#E1E1E1'/></pattern>
        <pattern id='pat_poly_0017' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#0E0F10'/><rect width='4' height='8' fill='#D1D1D1'/></pattern>
        
        <pattern id='pat_poly_0045' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#1A1D68'/><rect width='4' height='8' fill='#9292B6'/></pattern>
        <pattern id='pat_poly_0048' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#6C69BB'/><rect width='4' height='8' fill='#AFAFDB'/></pattern>
        <pattern id='pat_poly_0049' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#6C69BB'/><rect width='4' height='8' fill='#B1AFDB'/></pattern>
        <pattern id='pat_poly_0060' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#181D67'/><rect width='4' height='8' fill='#7A7CA7'/></pattern>
        <pattern id='pat_poly_0074' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#1D1D66'/><rect width='4' height='8' fill='#7477A5'/></pattern>
       
       
      </defs>
      <polygon points="418,158 418,205 566,206 566,331 505,332 505,389 654,389 654,332 592,331 592,206 739,205 739,158" fill="#BCBBC3" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="0" data-fill="#BCBBC3" data-seat-level="STAGE" data-capacity="None" data-component-count="None" data-ratio="0.0791309837949847" data-color-group="10"></polygon>

      <polygon points="422,229 422,314 550,314 550,229" fill="#6C69BB" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="1" data-fill="#6C69BB" data-seat-level="STANDING" data-capacity="None" data-component-count="None" data-ratio="0.03202444218454968" data-color-group="17"></polygon>
      <polygon points="606,229 606,314 734,314 734,229" fill="#6C69BB" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="2" data-fill="#6C69BB" data-seat-level="STANDING" data-capacity="None" data-component-count="None" data-ratio="0.03202444218454968" data-color-group="17"></polygon>
     
      
      <polygon points="351,309 281,378 281,468 297,487 390,397 390,350" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="7" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.03635127398705777" data-color-group="26"></polygon>
      <polygon points="811,309 773,349 772,396 865,487 881,469 881,376" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="17" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.03648814315632078" data-color-group="26"></polygon>
      <polygon points="128,324 128,422 234,422 234,324" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="18" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.004903742709509169" data-color-group="26"></polygon>
      
      <polygon points="926,324 926,422 1032,422 1032,324" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="28" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.02278798082654261" data-color-group="26"></polygon>
      
      <polygon points="434,407 435,469 723,469 723,406" fill="#6C69BB" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="3" data-fill="#6C69BB" data-seat-level="STANDING" data-capacity="None" data-component-count="None" data-ratio="0.05358795904521245" data-color-group="17"></polygon>
      
      <polygon points="373,437 312,501 388,573 390,451" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="8" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.018059371785230198" data-color-group="26"></polygon>
      <polygon points="790,437 772,453 775,573 850,502" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="16" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.018227146895939694" data-color-group="26"></polygon>
      <polygon points="128,439 128,537 234,537 234,439" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="19" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.004903742709509169" data-color-group="26"></polygon>
      
      <polygon points="926,439 926,537 1032,537 1032,439" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="27" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.02278650911504516" data-color-group="26"></polygon>
      
      
      <polygon points="424,486 424,525 734,525 734,486" fill="#BCBBC3" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="0" data-fill="#BCBBC3" data-seat-level="CONSOLE" data-capacity="None" data-component-count="None" data-ratio="0.03558598400838287" data-color-group="10"></polygon>
      
      <polygon points="286,504 281,512 281,625 299,642 361,575" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="9" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.01906455073798973" data-color-group="26"></polygon>
      <polygon points="877,504 801,576 864,642 881,626" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="15" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.01869809457512425" data-color-group="26"></polygon>
      <polygon points="431,544 431,697 489,698 490,545" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="4" data-fill="#1B1D65" data-seat-level="VIP" data-capacity="None" data-component-count="None" data-ratio="0.02673952619720051" data-color-group="26"></polygon>
      <polygon points="508,544 507,697 650,697 650,545" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="5" data-fill="#1B1D65" data-seat-level="VIP" data-capacity="None" data-component-count="None" data-ratio="0.06480828750178445" data-color-group="26"></polygon>
      <polygon points="667,544 666,696 725,698 726,544" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="6" data-fill="#1B1D65" data-seat-level="VIP" data-capacity="None" data-component-count="None" data-ratio="0.02718986991542074" data-color-group="26"></polygon>
      <polygon points="128,554 128,671 234,671 234,554" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="20" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.005854468336862988" data-color-group="26"></polygon>
      
      <polygon points="926,554 926,670 1032,670 1032,555" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="26" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.027198700184405452" data-color-group="26"></polygon>
      
      
      <polygon points="377,591 290,674 349,733 390,697 390,606" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="10" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.02484101836548778" data-color-group="26"></polygon>
      <polygon points="786,591 772,607 772,696 813,733 872,673" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="14" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.024832188096503068" data-color-group="26"></polygon>
      
      
      <polygon points="971,612 971,614 973,614 973,612" fill="#54558D" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="poly_0080" data-fill="#54558D" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="1.1773691979613852e-05" data-color-group="43"></polygon>
      
      <polygon points="364,758 391,788 490,788 490,723 421,722 409,713" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="11" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.021813707815229566" data-color-group="26"></polygon>
      <polygon points="794,758 749,713 737,722 668,722 668,788 767,788" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="13" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.021815179526727017" data-color-group="26"></polygon>
      <polygon points="507,723 507,788 650,788 650,722" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="12" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.02777855451440143" data-color-group="26"></polygon>
      <polygon points="342,794 302,871 325,885 363,811" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="21" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.007379161448222982" data-color-group="26"></polygon>
      <polygon points="815,794 795,812 829,884 833,885 854,875 855,870 820,797" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="25" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.007374746313730627" data-color-group="26"></polygon>
      <polygon points="351,889 487,893 488,815 378,814" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="22" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.02890441380995201" data-color-group="26"></polygon>
      <polygon points="507,816 508,895 650,894 649,815" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="23" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.03366687221570581" data-color-group="26"></polygon>
      <polygon points="669,815 670,893 805,893 779,814" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="24" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.02888086642599278" data-color-group="26"></polygon>
     
    </svg>
  </div>
</div>
`;

  return (
    <div ref={rootRef}>
      <style>{`
        .wrapper{display:flex;align-items:center;justify-content:center;padding:16px}
        .card{background:#fff;padding:8px;position:relative;max-width:1100px;width:100%}
        svg{width:100%;height:auto;display:block}
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}
