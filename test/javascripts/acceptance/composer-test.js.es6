import selectKit from "helpers/select-kit-helper";
import { acceptance } from "helpers/qunit-helpers";
import { toggleCheckDraftPopup } from "discourse/controllers/composer";

acceptance("Composer", {
  loggedIn: true,
  pretend(server, helper) {
    server.get("/draft.json", () => {
      return helper.response({
        draft: null,
        draft_sequence: 42
      });
    });
    server.post("/uploads/lookup-urls", () => {
      return helper.response([]);
    });
  },
  settings: {
    enable_whispers: true
  }
});

QUnit.test("Tests the Composer controls", async assert => {
  await visit("/");
  assert.ok(exists("#create-topic"), "the create button is visible");

  await click("#create-topic");
  assert.ok(exists(".d-editor-input"), "the composer input is visible");
  assert.ok(
    exists(".title-input .popup-tip.bad.hide"),
    "title errors are hidden by default"
  );
  assert.ok(
    exists(".d-editor-textarea-wrapper .popup-tip.bad.hide"),
    "body errors are hidden by default"
  );

  await click("a.toggle-preview");
  assert.ok(
    !exists(".d-editor-preview:visible"),
    "clicking the toggle hides the preview"
  );

  await click("a.toggle-preview");
  assert.ok(
    exists(".d-editor-preview:visible"),
    "clicking the toggle shows the preview again"
  );

  await click("#reply-control button.create");
  assert.ok(
    !exists(".title-input .popup-tip.bad.hide"),
    "it shows the empty title error"
  );
  assert.ok(
    !exists(".d-editor-wrapper .popup-tip.bad.hide"),
    "it shows the empty body error"
  );

  await fillIn("#reply-title", "this is my new topic title");
  assert.ok(exists(".title-input .popup-tip.good"), "the title is now good");

  await fillIn(".d-editor-input", "this is the *content* of a post");
  assert.equal(
    find(".d-editor-preview")
      .html()
      .trim(),
    "<p>this is the <em>content</em> of a post</p>",
    "it previews content"
  );
  assert.ok(
    exists(".d-editor-textarea-wrapper .popup-tip.good"),
    "the body is now good"
  );

  const textarea = find("#reply-control .d-editor-input")[0];
  textarea.selectionStart = textarea.value.length;
  textarea.selectionEnd = textarea.value.length;

  // Testing keyboard events is tough!
  const mac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const event = document.createEvent("Event");
  event.initEvent("keydown", true, true);
  event[mac ? "metaKey" : "ctrlKey"] = true;
  event.keyCode = 66;

  Ember.run(() => textarea.dispatchEvent(event));

  const example = I18n.t(`composer.bold_text`);
  assert.equal(
    find("#reply-control .d-editor-input")
      .val()
      .trim(),
    `this is the *content* of a post**${example}**`,
    "it supports keyboard shortcuts"
  );

  await click("#reply-control a.cancel");
  assert.ok(exists(".bootbox.modal"), "it pops up a confirmation dialog");

  await click(".modal-footer a:eq(1)");
  assert.ok(!exists(".bootbox.modal"), "the confirmation can be cancelled");
});

QUnit.test("Composer upload placeholder", async assert => {
  await visit("/");
  await click("#create-topic");

  const file1 = new Blob([""], { type: "image/png" });
  file1.name = "test.png";
  const data1 = {
    files: [file1],
    result: {
      original_filename: "test.png",
      thumbnail_width: 200,
      thumbnail_height: 300,
      url: "/uploads/test1.ext"
    }
  };

  const file2 = new Blob([""], { type: "image/png" });
  file2.name = "test.png";
  const data2 = {
    files: [file2],
    result: {
      original_filename: "test.png",
      thumbnail_width: 100,
      thumbnail_height: 200,
      url: "/uploads/test2.ext"
    }
  };

  const file3 = new Blob([""], { type: "image/png" });
  file3.name = "image.png";
  const data3 = {
    files: [file3],
    result: {
      original_filename: "image.png",
      thumbnail_width: 300,
      thumbnail_height: 400,
      url: "/uploads/test3.ext"
    }
  };

  const file4 = new Blob([""], { type: "image/png" });
  file4.name = "ima++ge.png";
  const data4 = {
    files: [file4],
    result: {
      original_filename: "ima++ge.png",
      thumbnail_width: 300,
      thumbnail_height: 400,
      url: "/uploads/test3.ext"
    }
  };

  await find(".wmd-controls").trigger("fileuploadsend", data1);
  assert.equal(find(".d-editor-input").val(), "[Uploading: test.png...]() ");

  await find(".wmd-controls").trigger("fileuploadsend", data2);
  assert.equal(
    find(".d-editor-input").val(),
    "[Uploading: test.png...]() [Uploading: test.png(1)...]() "
  );

  await find(".wmd-controls").trigger("fileuploadsend", data4);
  assert.equal(
    find(".d-editor-input").val(),
    "[Uploading: test.png...]() [Uploading: test.png(1)...]() [Uploading: ima++ge.png...]() ",
    "should accept files with unescaped characters"
  );

  await find(".wmd-controls").trigger("fileuploadsend", data3);
  assert.equal(
    find(".d-editor-input").val(),
    "[Uploading: test.png...]() [Uploading: test.png(1)...]() [Uploading: ima++ge.png...]() [Uploading: image.png...]() "
  );

  await find(".wmd-controls").trigger("fileuploaddone", data2);
  assert.equal(
    find(".d-editor-input").val(),
    "[Uploading: test.png...]() ![test|100x200](/uploads/test2.ext) [Uploading: ima++ge.png...]() [Uploading: image.png...]() "
  );

  await find(".wmd-controls").trigger("fileuploaddone", data3);
  assert.equal(
    find(".d-editor-input").val(),
    "[Uploading: test.png...]() ![test|100x200](/uploads/test2.ext) [Uploading: ima++ge.png...]() ![image|300x400](/uploads/test3.ext) "
  );

  await find(".wmd-controls").trigger("fileuploaddone", data1);
  assert.equal(
    find(".d-editor-input").val(),
    "![test|200x300](/uploads/test1.ext) ![test|100x200](/uploads/test2.ext) [Uploading: ima++ge.png...]() ![image|300x400](/uploads/test3.ext) "
  );
});

QUnit.test("Create a topic with server side errors", async assert => {
  await visit("/");
  await click("#create-topic");
  await fillIn("#reply-title", "this title triggers an error");
  await fillIn(".d-editor-input", "this is the *content* of a post");
  await click("#reply-control button.create");
  assert.ok(exists(".bootbox.modal"), "it pops up an error message");
  await click(".bootbox.modal a.btn-primary");
  assert.ok(!exists(".bootbox.modal"), "it dismisses the error");
  assert.ok(exists(".d-editor-input"), "the composer input is visible");
});

QUnit.test("Create a Topic", async assert => {
  await visit("/");
  await click("#create-topic");
  await fillIn("#reply-title", "Internationalization Localization");
  await fillIn(".d-editor-input", "this is the *content* of a new topic post");
  await click("#reply-control button.create");
  assert.equal(
    currentURL(),
    "/t/internationalization-localization/280",
    "it transitions to the newly created topic URL"
  );
});

QUnit.test("Create an enqueued Topic", async assert => {
  await visit("/");
  await click("#create-topic");
  await fillIn("#reply-title", "Internationalization Localization");
  await fillIn(".d-editor-input", "enqueue this content please");
  await click("#reply-control button.create");
  assert.ok(visible(".d-modal"), "it pops up a modal");
  assert.equal(currentURL(), "/", "it doesn't change routes");

  await click(".modal-footer button");
  assert.ok(invisible(".d-modal"), "the modal can be dismissed");
});

QUnit.test("Create a Reply", async assert => {
  await visit("/t/internationalization-localization/280");

  assert.ok(
    !exists("article[data-post-id=12345]"),
    "the post is not in the DOM"
  );

  await click("#topic-footer-buttons .btn.create");
  assert.ok(exists(".d-editor-input"), "the composer input is visible");
  assert.ok(!exists("#reply-title"), "there is no title since this is a reply");

  await fillIn(".d-editor-input", "this is the content of my reply");
  await click("#reply-control button.create");
  assert.equal(
    find(".cooked:last p").text(),
    "If you use gettext format you could leverage Launchpad 13 translations and the community behind it."
  );
});

QUnit.test("Posting on a different topic", async assert => {
  await visit("/t/internationalization-localization/280");
  await click("#topic-footer-buttons .btn.create");
  await fillIn(".d-editor-input", "this is the content for a different topic");

  await visit("/t/1-3-0beta9-no-rate-limit-popups/28830");
  assert.equal(currentURL(), "/t/1-3-0beta9-no-rate-limit-popups/28830");
  await click("#reply-control button.create");
  assert.ok(visible(".reply-where-modal"), "it pops up a modal");

  await click(".btn-reply-here");
  assert.equal(
    find(".cooked:last p").text(),
    "If you use gettext format you could leverage Launchpad 13 translations and the community behind it."
  );
});

QUnit.test("Create an enqueued Reply", async assert => {
  await visit("/t/internationalization-localization/280");

  assert.notOk(find(".pending-posts .reviewable-item").length);

  await click("#topic-footer-buttons .btn.create");
  assert.ok(exists(".d-editor-input"), "the composer input is visible");
  assert.ok(!exists("#reply-title"), "there is no title since this is a reply");

  await fillIn(".d-editor-input", "enqueue this content please");
  await click("#reply-control button.create");
  assert.ok(
    find(".cooked:last p").text() !== "enqueue this content please",
    "it doesn't insert the post"
  );

  assert.ok(visible(".d-modal"), "it pops up a modal");

  await click(".modal-footer button");
  assert.ok(invisible(".d-modal"), "the modal can be dismissed");

  assert.ok(find(".pending-posts .reviewable-item").length);
});

QUnit.test("Edit the first post", async assert => {
  await visit("/t/internationalization-localization/280");

  assert.ok(
    !exists(".topic-post:eq(0) .post-info.edits"),
    "it has no edits icon at first"
  );

  await click(".topic-post:eq(0) button.show-more-actions");
  await click(".topic-post:eq(0) button.edit");
  assert.equal(
    find(".d-editor-input")
      .val()
      .indexOf("Any plans to support"),
    0,
    "it populates the input with the post text"
  );

  await fillIn(".d-editor-input", "This is the new text for the post");
  await fillIn("#reply-title", "This is the new text for the title");
  await click("#reply-control button.create");
  assert.ok(!exists(".d-editor-input"), "it closes the composer");
  assert.ok(
    exists(".topic-post:eq(0) .post-info.edits"),
    "it has the edits icon"
  );
  assert.ok(
    find("#topic-title h1")
      .text()
      .indexOf("This is the new text for the title") !== -1,
    "it shows the new title"
  );
  assert.ok(
    find(".topic-post:eq(0) .cooked")
      .text()
      .indexOf("This is the new text for the post") !== -1,
    "it updates the post"
  );
});

QUnit.test("Composer can switch between edits", async assert => {
  await visit("/t/this-is-a-test-topic/9");

  await click(".topic-post:eq(0) button.edit");
  assert.equal(
    find(".d-editor-input")
      .val()
      .indexOf("This is the first post."),
    0,
    "it populates the input with the post text"
  );
  await click(".topic-post:eq(1) button.edit");
  assert.equal(
    find(".d-editor-input")
      .val()
      .indexOf("This is the second post."),
    0,
    "it populates the input with the post text"
  );
});

QUnit.test(
  "Composer with dirty edit can toggle to another edit",
  async assert => {
    await visit("/t/this-is-a-test-topic/9");

    await click(".topic-post:eq(0) button.edit");
    await fillIn(".d-editor-input", "This is a dirty reply");
    await click(".topic-post:eq(1) button.edit");
    assert.ok(exists(".bootbox.modal"), "it pops up a confirmation dialog");

    await click(".modal-footer a:eq(0)");
    assert.equal(
      find(".d-editor-input")
        .val()
        .indexOf("This is the second post."),
      0,
      "it populates the input with the post text"
    );
  }
);

QUnit.test("Composer can toggle between edit and reply", async assert => {
  await visit("/t/this-is-a-test-topic/9");

  await click(".topic-post:eq(0) button.edit");
  assert.equal(
    find(".d-editor-input")
      .val()
      .indexOf("This is the first post."),
    0,
    "it populates the input with the post text"
  );
  await click(".topic-post:eq(0) button.reply");
  assert.equal(find(".d-editor-input").val(), "", "it clears the input");
  await click(".topic-post:eq(0) button.edit");
  assert.equal(
    find(".d-editor-input")
      .val()
      .indexOf("This is the first post."),
    0,
    "it populates the input with the post text"
  );
});

QUnit.test("Composer can toggle whispers", async assert => {
  const menu = selectKit(".toolbar-popup-menu-options");

  await visit("/t/this-is-a-test-topic/9");
  await click(".topic-post:eq(0) button.reply");

  await menu.expand();
  await menu.selectRowByValue("toggleWhisper");

  assert.ok(
    find(".composer-fields .whisper .d-icon-far-eye-slash").length === 1,
    "it sets the post type to whisper"
  );

  await menu.expand();
  await menu.selectRowByValue("toggleWhisper");

  assert.ok(
    find(".composer-fields .whisper .d-icon-far-eye-slash").length === 0,
    "it removes the whisper mode"
  );

  await menu.expand();
  await menu.selectRowByValue("toggleWhisper");

  await click(".toggle-fullscreen");

  assert.ok(
    menu.rowByValue("toggleWhisper").exists(),
    "whisper toggling is still present when going fullscreen"
  );
});

QUnit.test(
  "Composer can toggle layouts (open, fullscreen and draft)",
  async assert => {
    await visit("/t/this-is-a-test-topic/9");
    await click(".topic-post:eq(0) button.reply");

    assert.ok(
      find("#reply-control.open").length === 1,
      "it starts in open state by default"
    );

    await click(".toggle-fullscreen");

    assert.ok(
      find("#reply-control.fullscreen").length === 1,
      "it expands composer to full screen"
    );

    await click(".toggle-fullscreen");

    assert.ok(
      find("#reply-control.open").length === 1,
      "it collapses composer to regular size"
    );

    await fillIn(".d-editor-input", "This is a dirty reply");
    await click(".toggler");

    assert.ok(
      find("#reply-control.draft").length === 1,
      "it collapses composer to draft bar"
    );

    await click(".toggle-fullscreen");

    assert.ok(
      find("#reply-control.open").length === 1,
      "from draft, it expands composer back to open state"
    );
  }
);

QUnit.test(
  "Composer can toggle between reply and createTopic",
  async assert => {
    await visit("/t/this-is-a-test-topic/9");
    await click(".topic-post:eq(0) button.reply");

    await selectKit(".toolbar-popup-menu-options").expand();
    await selectKit(".toolbar-popup-menu-options").selectRowByValue(
      "toggleWhisper"
    );

    assert.ok(
      find(".composer-fields .whisper .d-icon-far-eye-slash").length === 1,
      "it sets the post type to whisper"
    );

    await visit("/");
    assert.ok(exists("#create-topic"), "the create topic button is visible");

    await click("#create-topic");
    assert.ok(
      find(".composer-fields .whisper .d-icon-far-eye-slash").length === 0,
      "it should reset the state of the composer's model"
    );

    await selectKit(".toolbar-popup-menu-options").expand();
    await selectKit(".toolbar-popup-menu-options").selectRowByValue(
      "toggleInvisible"
    );

    assert.ok(
      find(".composer-fields .whisper")
        .text()
        .indexOf(I18n.t("composer.unlist")) > 0,
      "it sets the topic to unlisted"
    );

    await visit("/t/this-is-a-test-topic/9");

    await click(".topic-post:eq(0) button.reply");
    assert.ok(
      find(".composer-fields .whisper")
        .text()
        .indexOf(I18n.t("composer.unlist")) === -1,
      "it should reset the state of the composer's model"
    );
  }
);

QUnit.test("Composer with dirty reply can toggle to edit", async assert => {
  await visit("/t/this-is-a-test-topic/9");

  await click(".topic-post:eq(0) button.reply");
  await fillIn(".d-editor-input", "This is a dirty reply");
  await click(".topic-post:eq(0) button.edit");
  assert.ok(exists(".bootbox.modal"), "it pops up a confirmation dialog");
  await click(".modal-footer a:eq(0)");
  assert.equal(
    find(".d-editor-input")
      .val()
      .indexOf("This is the first post."),
    0,
    "it populates the input with the post text"
  );
});

QUnit.test(
  "Composer draft with dirty reply can toggle to edit",
  async assert => {
    await visit("/t/this-is-a-test-topic/9");

    await click(".topic-post:eq(0) button.reply");
    await fillIn(".d-editor-input", "This is a dirty reply");
    await click(".toggler");
    await click(".topic-post:eq(1) button.edit");
    assert.ok(exists(".bootbox.modal"), "it pops up a confirmation dialog");
    assert.equal(
      find(".modal-footer a:eq(1)").text(),
      I18n.t("post.abandon.no_value")
    );
    await click(".modal-footer a:eq(0)");
    assert.equal(
      find(".d-editor-input")
        .val()
        .indexOf("This is the second post."),
      0,
      "it populates the input with the post text"
    );
  }
);

QUnit.test(
  "Composer draft can switch to draft in new context without destroying current draft",
  async assert => {
    await visit("/t/this-is-a-test-topic/9");

    await click(".topic-post:eq(0) button.reply");
    await fillIn(".d-editor-input", "This is a dirty reply");

    await click("#site-logo");
    await click("#create-topic");

    assert.ok(exists(".bootbox.modal"), "it pops up a confirmation dialog");
    assert.equal(
      find(".modal-footer a:eq(1)").text(),
      I18n.t("post.abandon.no_save_draft")
    );
    await click(".modal-footer a:eq(1)");
    assert.equal(
      find(".d-editor-input").val(),
      "",
      "it populates the input with the post text"
    );
  }
);

QUnit.test("Checks for existing draft", async assert => {
  try {
    toggleCheckDraftPopup(true);

    // prettier-ignore
    server.get("/draft.json", () => { // eslint-disable-line no-undef
      return [ 200, { "Content-Type": "application/json" }, {
        draft: "{\"reply\":\"This is a draft of the first post\",\"action\":\"reply\",\"categoryId\":1,\"archetypeId\":\"regular\",\"metaData\":null,\"composerTime\":2863,\"typingTime\":200}",
        draft_sequence: 42
      } ];
    });

    await visit("/t/internationalization-localization/280");

    await click(".topic-post:eq(0) button.show-more-actions");
    await click(".topic-post:eq(0) button.edit");

    assert.equal(find(".modal-body").text(), I18n.t("drafts.abandon.confirm"));

    await click(".modal-footer .btn.btn-default");
  } finally {
    toggleCheckDraftPopup(false);
  }
});

QUnit.test("Can switch states without abandon popup", async assert => {
  try {
    const composerActions = selectKit(".composer-actions");
    toggleCheckDraftPopup(true);

    await visit("/t/internationalization-localization/280");

    const longText = "a".repeat(256);

    await click(".btn-primary.create.btn");

    await fillIn(".d-editor-input", longText);

    // prettier-ignore
    server.get("/draft.json", () => { // eslint-disable-line no-undef
      return [ 200, { "Content-Type": "application/json" }, {
        draft: "{\"reply\":\"This is a draft of the first post\",\"action\":\"reply\",\"categoryId\":1,\"archetypeId\":\"regular\",\"metaData\":null,\"composerTime\":2863,\"typingTime\":200}",
        draft_sequence: 42
      } ];
    });

    await click("article#post_3 button.reply");

    await composerActions.expand();
    await composerActions.selectRowByValue("reply_to_topic");

    assert.equal(
      find(".modal-body").text(),
      "",
      "abandon popup shouldn't come"
    );

    assert.equal(
      find(".d-editor-input").val(),
      longText,
      "entered text should still be there"
    );

    assert.ok(
      find('.action-title a[href="/t/internationalization-localization/280"]'),
      "mode should have changed"
    );

    assert.ok(find(".save-animation"), "save animation should show");
  } finally {
    toggleCheckDraftPopup(false);
  }
});

QUnit.test("Loading draft also replaces the recipients", async assert => {
  try {
    toggleCheckDraftPopup(true);

    // prettier-ignore
    server.get("/draft.json", () => { // eslint-disable-line no-undef
      return [ 200, { "Content-Type": "application/json" }, {
         "draft":"{\"reply\":\"hello\",\"action\":\"privateMessage\",\"title\":\"hello\",\"categoryId\":null,\"archetypeId\":\"private_message\",\"metaData\":null,\"usernames\":\"codinghorror\",\"composerTime\":9159,\"typingTime\":2500}",
         "draft_sequence":0
      } ];
    });

    await visit("/u/charlie");
    await click("button.compose-pm");
    await click(".modal .btn-default");

    assert.equal(find(".users-input .item:eq(0)").text(), "codinghorror");
  } finally {
    toggleCheckDraftPopup(false);
  }
});

QUnit.test(
  "Deleting the text content of the first post in a private message",
  async assert => {
    Discourse.SiteSettings.allow_uncategorized_topics = false;

    await visit("/t/34");

    await click("#post_1 .d-icon-ellipsis-h");

    await click("#post_1 .d-icon-pencil-alt");

    await fillIn(".d-editor-input", "");

    assert.equal(
      find(".d-editor-container textarea").attr("placeholder"),
      I18n.t("composer.reply_placeholder"),
      "it should not block because of missing category"
    );
  }
);

const assertImageResized = (assert, uploads) => {
  assert.equal(
    find(".d-editor-input").val(),
    uploads.join("\n"),
    "it resizes uploaded image"
  );
};

QUnit.test("Image resizing buttons", async assert => {
  await visit("/");
  await click("#create-topic");

  let uploads = [
    "![test|690x313](upload://test.png)",
    "[img]http://example.com/image.jpg[/img]",
    "![anotherOne|690x463](upload://anotherOne.jpeg)",
    "![](upload://withoutAltAndSize.jpeg)",
    "`![test|690x313](upload://test.png)`",
    "![withoutSize](upload://withoutSize.png)",
    "<img src='http://someimage.jpg' wight='20' height='20'>",
    "![onTheSameLine1|200x200](upload://onTheSameLine1.jpeg) ![onTheSameLine2|250x250](upload://onTheSameLine2.jpeg)",
    "![identicalImage|300x300](upload://identicalImage.png)",
    "![identicalImage|300x300](upload://identicalImage.png)"
  ];

  await fillIn(".d-editor-input", uploads.join("\n"));

  assert.ok(
    find(".button-wrapper").length === 6,
    "it adds correct amount of scaling button groups"
  );

  uploads[0] = "![test|690x313,50%](upload://test.png)";
  await click(find(".button-wrapper .scale-btn[data-scale='50']")[0]);
  assertImageResized(assert, uploads);

  uploads[2] = "![anotherOne|690x463,75%](upload://anotherOne.jpeg)";
  await click(find(".button-wrapper .scale-btn[data-scale='75']")[1]);
  assertImageResized(assert, uploads);

  uploads[7] =
    "![onTheSameLine1|200x200,50%](upload://onTheSameLine1.jpeg) ![onTheSameLine2|250x250](upload://onTheSameLine2.jpeg)";
  await click(find(".button-wrapper .scale-btn[data-scale='50']")[2]);
  assertImageResized(assert, uploads);

  uploads[7] =
    "![onTheSameLine1|200x200,50%](upload://onTheSameLine1.jpeg) ![onTheSameLine2|250x250,75%](upload://onTheSameLine2.jpeg)";
  await click(find(".button-wrapper .scale-btn[data-scale='75']")[3]);
  assertImageResized(assert, uploads);

  uploads[8] = "![identicalImage|300x300,50%](upload://identicalImage.png)";
  await click(find(".button-wrapper .scale-btn[data-scale='50']")[4]);
  assertImageResized(assert, uploads);

  uploads[9] = "![identicalImage|300x300,75%](upload://identicalImage.png)";
  await click(find(".button-wrapper .scale-btn[data-scale='75']")[5]);
  assertImageResized(assert, uploads);

  await fillIn(
    ".d-editor-input",
    `
![test|690x313](upload://test.png)

\`<script>alert("xss")</script>\`
    `
  );

  assert.ok(
    find("script").length === 0,
    "it does not unescapes script tags in code blocks"
  );
});
