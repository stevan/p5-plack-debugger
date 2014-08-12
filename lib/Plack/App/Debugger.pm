package Plack::App::Debugger;

use strict;
use warnings;

use parent 'Plack::Component';

use Plack::Util::Accessor (
    'debugger', # a reference to the Plack::Debugger
);

sub prepare_app {}

sub call {
    my ($self, $env) = @_;

    return [ 500, [], [] ]; # stub
}

1;

__END__