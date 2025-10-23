#![allow(unused)]

use wasm_bindgen::prelude::*;
use web_sys::{console, Document};

#[wasm_bindgen(start)]
pub fn start() -> Result<(), JsValue> {
    // Log so we can see the wasm stub loaded
    console::log_1(&"turunmap_wasm: stub loaded".into());

    // Hide the loading spinner if present
    if let Some(window) = web_sys::window() {
        if let Some(doc) = window.document() {
            remove_loading_text(&doc);
        }
    }

    Ok(())
}

fn remove_loading_text(doc: &Document) {
    if let Some(el) = doc.get_element_by_id("loading_text") {
        // remove children / text
        el.set_inner_html("");
        // optionally hide it
        if let Some(elem) = el.dyn_ref::<web_sys::HtmlElement>() {
            elem.style().set_property("display", "none").ok();
        }
    }
}
