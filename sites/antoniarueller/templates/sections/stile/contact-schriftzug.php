<?= sec_head($no['contact'], $sec['contact_label'], $contact['right'], '0') ?>
<h2 class="ks-h"><?= e($contact['h1']) ?></h2>
<p class="ks-in"><?= e($contact['intro']) ?></p>
<?= contact_mail_button($contact, $hasMail, $sec, 'ks-mail') ?>
<div class="ks-so"><?= contact_social_links($social, 'ks-sl') ?></div>
<p class="mailnote" id="mailnote" aria-live="polite" hidden></p>
